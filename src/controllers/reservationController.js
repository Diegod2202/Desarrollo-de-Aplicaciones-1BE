import pool from "../config/db.js";

// POST /reservations
export const createReservation = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { class_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      conn.release();
      return res.status(401).json({ error: "No autenticado" });
    }
    if (!class_id) {
      conn.release();
      return res.status(400).json({ error: "class_id es requerido" });
    }

    // Iniciamos transacción
    await conn.beginTransaction();

    // 1) Traer clase y bloquearla para actualizar cupo de forma segura
    const [classes] = await conn.execute(
      "SELECT id, fecha, hora, cupo FROM classes WHERE id = ? FOR UPDATE",
      [class_id]
    );
    if (classes.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: "Clase no encontrada" });
    }
    const clase = classes[0];

    // 2) Validar que la clase no haya pasado (fecha/hora)
    const now = new Date();
    const classDateTime = new Date(`${clase.fecha}T${clase.hora}`);
    if (isNaN(classDateTime.getTime()) || classDateTime <= now) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: "La clase ya ocurrió. No se puede reservar." });
    }

    // 3) Validar cupo
    if (clase.cupo <= 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: "Cupo lleno" });
    }

    // 4) Evitar duplicado: misma clase ya reservada por el usuario
    const [dup] = await conn.execute(
      "SELECT id FROM reservations WHERE user_id = ? AND class_id = ? AND status = 'confirmada'",
      [userId, class_id]
    );
    if (dup.length > 0) {
      await conn.rollback(); conn.release();
      return res.status(409).json({ error: "Ya tenés esta clase reservada." });
    }

    // 5) (Extra) Evitar choque de horario exacto en el mismo día
    const [overlap] = await conn.execute(
      `SELECT r.id
       FROM reservations r
       JOIN classes c ON c.id = r.class_id
       WHERE r.user_id = ? AND r.status = 'confirmada'
         AND c.fecha = ? AND c.hora = ?`,
      [userId, clase.fecha, clase.hora]
    );
    if (overlap.length > 0) {
      await conn.rollback(); conn.release();
      return res.status(409).json({ error: "Ya tenés una clase reservada en ese horario." });
    }

    // 6) Insertar reserva
    const [result] = await conn.execute(
      "INSERT INTO reservations (user_id, class_id, status) VALUES (?, ?, 'confirmada')",
      [userId, class_id]
    );

    // 7) Descontar cupo
    await conn.execute("UPDATE classes SET cupo = cupo - 1 WHERE id = ?", [class_id]);

    await conn.commit(); conn.release();
    return res.status(201).json({ message: "Reserva creada", reservationId: result.insertId });
  } catch (err) {
    console.error(err);
    try { await conn.rollback(); } catch {}
    if (conn) conn.release();

    // Si tu tabla tiene UNIQUE(user_id, class_id) y explota por duplicado:
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Ya tenés esta clase reservada." });
    }
    return res.status(500).json({ error: "Error creando reserva" });
  }
};

// DELETE /reservations/:id   (actualiza status a cancelada)
export const cancelReservation = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      conn.release();
      return res.status(401).json({ error: "No autenticado" });
    }

    await conn.beginTransaction();

    // 1) Buscar la reserva del usuario y bloquearla
    const [rows] = await conn.execute(
      "SELECT id, class_id, status FROM reservations WHERE id = ? AND user_id = ? FOR UPDATE",
      [id, userId]
    );
    if (rows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const reserva = rows[0];
    if (reserva.status !== "confirmada") {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: "La reserva ya fue cancelada" });
    }

    // 2) Cancelar y devolver cupo
    await conn.execute("UPDATE reservations SET status = 'cancelada' WHERE id = ?", [id]);
    await conn.execute("UPDATE classes SET cupo = cupo + 1 WHERE id = ?", [reserva.class_id]);

    await conn.commit(); conn.release();
    return res.json({ message: "Reserva cancelada" });
  } catch (err) {
    console.error(err);
    try { await conn.rollback(); } catch {}
    if (conn) conn.release();
    return res.status(500).json({ error: "Error cancelando reserva" });
  }
};

// GET /reservations/me
export const getMyReservations = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT r.id as reservation_id, r.status, r.created_at,
              c.id, c.name, c.discipline, c.sede, c.fecha, c.hora, c.cupo, c.profesor, c.duracion
       FROM reservations r
       JOIN classes c ON r.class_id = c.id
       WHERE r.user_id = ? AND r.status = 'confirmada'
       ORDER BY c.fecha, c.hora`,
      [userId]
    );
    conn.release();

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error obteniendo reservas" });
  }
};
