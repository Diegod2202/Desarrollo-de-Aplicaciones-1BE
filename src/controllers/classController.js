import pool from "../config/db.js";

// GET /classes?disciplina=Funcional&sede=Palermo&fecha=2025-09-22&limit=20&offset=0&showPast=false
export const getClasses = async (req, res) => {
  try {
    const { disciplina, sede, fecha, limit, offset, showPast } = req.query;

    let query = `
      SELECT id, name, discipline, sede, fecha, hora, cupo, profesor, duracion
      FROM classes
      WHERE 1=1
    `;
    const params = [];

    if (disciplina) { query += " AND discipline = ?"; params.push(disciplina); }
    if (sede)       { query += " AND sede = ?";       params.push(sede); }
    if (fecha)      { query += " AND fecha = ?";      params.push(fecha); }

    // Por defecto mostramos TODO; si showPast === "false", solo futuras
    const onlyFuture = String(showPast).toLowerCase() === "false";
    if (onlyFuture) {
      query += " AND (fecha > CURDATE() OR (fecha = CURDATE() AND hora >= CURTIME()))";
    }

    query += " ORDER BY fecha ASC, hora ASC";

    // Paginación con defaults seguros
    const lim = Number.isFinite(parseInt(limit)) ? Math.max(1, parseInt(limit)) : 50;
    const off = Number.isFinite(parseInt(offset)) ? Math.max(0, parseInt(offset)) : 0;
    query += ` LIMIT ${lim} OFFSET ${off}`;

    const conn = await pool.getConnection();
    const [rows] = await conn.execute(query, params);
    conn.release();

    return res.json(rows);
  } catch (err) {
    console.error("[/classes] ERROR:", err?.code, err?.message);
    return res.status(500).json({ error: "Error obteniendo clases" });
  }
};

// GET /classes/:id
export const getClassById = async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT id, name, discipline, sede, fecha, hora, cupo, profesor, duracion
       FROM classes
       WHERE id = ?`,
      [id]
    );
    conn.release();

    if (rows.length === 0) return res.status(404).json({ error: "Clase no encontrada" });
    return res.json(rows[0]);
  } catch (err) {
    console.error("[/classes/:id] ERROR:", err?.code, err?.message);
    return res.status(500).json({ error: "Error obteniendo detalle de clase" });
  }
};
