import pool from "../config/db.js";

// GET /history?from=2025-09-01&to=2025-09-30
export const getHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const { from, to } = req.query;

    let query = `
      SELECT 
        h.id AS history_id, 
        h.asistencia_fecha,
        c.id AS class_id,
        c.name, 
        c.discipline, 
        c.sede, 
        c.fecha, 
        c.hora, 
        c.profesor, 
        c.duracion
      FROM history h
      JOIN classes c ON h.class_id = c.id
      WHERE h.user_id = ?
    `;
    const params = [userId];

    if (from) {
      query += " AND h.asistencia_fecha >= ?";
      params.push(from);
    }
    if (to) {
      query += " AND h.asistencia_fecha <= ?";
      params.push(to);
    }

    query += " ORDER BY h.asistencia_fecha DESC";

    const conn = await pool.getConnection();
    const [rows] = await conn.execute(query, params);
    conn.release();

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo historial" });
  }
};
