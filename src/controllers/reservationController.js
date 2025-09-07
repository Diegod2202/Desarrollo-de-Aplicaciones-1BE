import pool from "../config/db.js";

// POST /reservations
export const createReservation = async (req, res) => {
  try {
    const { class_id } = req.body;
    const userId = req.user.id;

    const conn = await pool.getConnection();

    // Ver si existe la clase
    const [classes] = await conn.execute("SELECT * FROM classes WHERE id = ?", [class_id]);
    if (classes.length === 0) {
      conn.release();
      return res.status(404).json({ error: "Clase no encontrada" });
    }

    const clase = classes[0];

    // Ver cuántas reservas tiene la clase
    const [reservations] = await conn.execute(
      "SELECT COUNT(*) as total FROM reservations WHERE class_id = ? AND status = 'confirmada'",
      [class_id]
    );

    if (reservations[0].total >= clase.cupo) {
      conn.release();
      return res.status(400).json({ error: "Cupo lleno" });
    }

    // Insertar reserva
    const [result] = await conn.execute(
      "INSERT INTO reservations (user_id, class_id, status) VALUES (?, ?, 'confirmada')",
      [userId, class_id]
    );

    conn.release();
    res.json({ message: "Reserva creada", reservationId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando reserva" });
  }
};

// DELETE /reservations/:id
export const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      "SELECT * FROM reservations WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (rows.length === 0) {
      conn.release();
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    await conn.execute("UPDATE reservations SET status = 'cancelada' WHERE id = ?", [id]);
    conn.release();

    res.json({ message: "Reserva cancelada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cancelando reserva" });
  }
};

// GET /reservations/me
export const getMyReservations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT r.id as reservation_id, r.status, c.*
       FROM reservations r
       JOIN classes c ON r.class_id = c.id
       WHERE r.user_id = ? AND r.status = 'confirmada'
       ORDER BY c.fecha, c.hora`,
      [userId]
    );
    conn.release();

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo reservas" });
  }
};
