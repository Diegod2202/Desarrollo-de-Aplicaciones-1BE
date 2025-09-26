import pool from "../config/db.js";

// GET /history?from=2025-09-01&to=2025-09-30
export const getHistory = async (req, res) => {
  const userId = req.user.id;
  const { from, to } = req.query;

  const conn = await pool.getConnection();
  try {
    let query = `
      SELECT
        r.id AS history_id,
        CONCAT(c.fecha, ' ', c.hora) AS asistencia_fecha,
        c.*
      FROM reservations r
      JOIN classes c ON c.id = r.class_id
      WHERE r.user_id = ?
        AND r.status = 'confirmada'
        AND CONCAT(c.fecha, ' ', c.hora) <= NOW()
    `;
    const params = [userId];

    if (from) { query += " AND c.fecha >= ?"; params.push(from); }
    if (to)   { query += " AND c.fecha <= ?"; params.push(to);   }

    query += " ORDER BY c.fecha DESC, c.hora DESC";

    const [rows] = await conn.execute(query, params);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error obteniendo historial" });
  } finally {
    conn.release();
  }
};

