import pool from "../config/db.js";

// GET /classes?disciplina=Funcional&sede=Palermo&fecha=2025-09-22&limit=20&offset=0&showPast=false
export const getClasses = async (req, res) => {
  try {
    const { disciplina, sede, fecha, limit, offset, showPast } = req.query;

    // Armado de query con filtros
    let query = `
      SELECT id, name, discipline, sede, fecha, hora, cupo, profesor, duracion, created_at
      FROM classes
      WHERE 1=1
    `;
    const params = [];

    if (disciplina) {
      query += " AND discipline = ?";
      params.push(disciplina);
    }
    if (sede) {
      query += " AND sede = ?";
      params.push(sede);
    }
    if (fecha) {
      query += " AND fecha = ?";
      params.push(fecha);
    }

    // Por defecto no mostramos clases pasadas (a menos que showPast=true)
    const includePast = String(showPast).toLowerCase() === "true";
    if (!includePast) {
      // futuras: fecha > hoy, o misma fecha y hora >= ahora
      query += " AND (fecha > CURDATE() OR (fecha = CURDATE() AND hora >= CURTIME()))";
    }

    // Orden
    query += " ORDER BY fecha ASC, hora ASC";

    // Paginación segura
    const lim = Number.isInteger(parseInt(limit)) ? Math.max(1, parseInt(limit)) : 50;
    const off = Number.isInteger(parseInt(offset)) ? Math.max(0, parseInt(offset)) : 0;
    query += " LIMIT ? OFFSET ?";
    params.push(lim, off);

    const conn = await pool.getConnection();
    const [rows] = await conn.execute(query, params);
    conn.release();

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo clases" });
  }
};

// GET /classes/:id
export const getClassById = async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT id, name, discipline, sede, fecha, hora, cupo, profesor, duracion, created_at
       FROM classes
       WHERE id = ?`,
      [id]
    );
    conn.release();

    if (rows.length === 0) return res.status(404).json({ error: "Clase no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo detalle de clase" });
  }
};
