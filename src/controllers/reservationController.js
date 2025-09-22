import pool from "../config/db.js";

/**
 * Chequea si la nueva reserva se superpone con otra del mismo usuario.
 * Compara intervalos [hora, hora+duracion) en la misma fecha.
 */
async function hasOverlap(conn, userId, clase) {
  const [rows] = await conn.query(
    `
    SELECT r.id
    FROM reservations r
    JOIN classes c ON c.id = r.class_id
    WHERE r.user_id = ?
      AND r.status = 'confirmada'
      AND c.fecha = ?
      AND NOT (
        ADDTIME(?, SEC_TO_TIME(? * 60)) <= c.hora
        OR
        ADDTIME(c.hora, SEC_TO_TIME(c.duracion * 60)) <= ?
      )
    LIMIT 1
    `,
    [userId, clase.fecha, clase.hora, clase.duracion, clase.hora]
  );
  return rows.length > 0;
}

// POST /reservations
export const createReservation = async (req, res) => {
  const { class_id } = req.body;
  const userId = req.user?.id;

  if (!userId || !class_id) {
    return res.status(400).json({ error: "userId (token) y class_id son requeridos" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Traer clase y BLOQUEAR fila para cupo
    const [classes] = await conn.query(
      `SELECT id, fecha, hora, duracion, cupo
       FROM classes
       WHERE id = ?
       FOR UPDATE`,
      [class_id]
    );
    if (classes.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Clase no encontrada" });
    }
    const clase = classes[0];

    // 2) Evitar reserva duplicada del mismo user a la misma clase
    const [dup] = await conn.query(
      `SELECT id FROM reservations WHERE user_id = ? AND class_id = ? AND status = 'confirmada' LIMIT 1`,
      [userId, class_id]
    );
    if (dup.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: "Ya tenés reserva en esta clase" });
    }

    // 3) Validar superposición de horarios
    const overlap = await hasOverlap(conn, userId, clase);
    if (overlap) {
      await conn.rollback();
      return res.status(409).json({ error: "Tenés otra clase que se superpone en horario" });
    }

    // 4) Validar cupo disponible
    if (clase.cupo <= 0) {
      await conn.rollback();
      return res.status(409).json({ error: "Sin cupo disponible" });
    }

    // 5) Insertar reserva
    const [ins] = await conn.query(
      `INSERT INTO reservations (user_id, class_id, status)
       VALUES (?, ?, 'confirmada')`,
      [userId, class_id]
    );

    // 6) Descontar 1 del cupo
    await conn.query(`UPDATE classes SET cupo = cupo - 1 WHERE id = ?`, [class_id]);

    await conn.commit();
    return res.status(201).json({
      message: "Reserva creada",
      reservationId: ins.insertId,
      cupo_restante: clase.cupo - 1
    });
  } catch (err) {
    await conn.rollback();
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Ya tenés reserva en esta clase" });
    }
    console.error("createReservation error", err);
    return res.status(500).json({ error: "Error creando reserva" });
  } finally {
    conn.release();
  }
};

// DELETE /reservations/:id
export const cancelReservation = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId || !id) {
    return res.status(400).json({ error: "userId (token) y id de reserva requeridos" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `
      SELECT r.id, r.class_id, r.status
      FROM reservations r
      JOIN classes c ON c.id = r.class_id
      WHERE r.id = ? AND r.user_id = ?
      FOR UPDATE
      `,
      [id, userId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const resv = rows[0];
    if (resv.status !== "confirmada") {
      await conn.rollback();
      return res.status(409).json({ error: "La reserva no está confirmada" });
    }

    await conn.query(`UPDATE reservations SET status = 'cancelada' WHERE id = ?`, [id]);
    await conn.query(`UPDATE classes SET cupo = cupo + 1 WHERE id = ?`, [resv.class_id]);

    await conn.commit();
    return res.json({ message: "Reserva cancelada" });
  } catch (err) {
    await conn.rollback();
    console.error("cancelReservation error", err);
    return res.status(500).json({ error: "Error cancelando reserva" });
  } finally {
    conn.release();
  }
};

// GET /reservations/me (igual que tenías, sólo formato)
export const getMyReservations = async (req, res) => {
  try {
    const userId = req.user.id;
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `
      SELECT r.id AS reservation_id, r.status, c.*
      FROM reservations r
      JOIN classes c ON r.class_id = c.id
      WHERE r.user_id = ? AND r.status = 'confirmada'
      ORDER BY c.fecha, c.hora
      `,
      [userId]
    );
    conn.release();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo reservas" });
  }
};
