import pool from "../config/db.js";

// GET /classes?disciplina=Funcional&sede=Palermo&fecha=2025-09-10
export const getClasses = async (req, res) => {
  try {
    const { disciplina, sede, fecha } = req.query;

    let query = "SELECT * FROM classes WHERE 1=1";
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
    const [rows] = await conn.execute("SELECT * FROM classes WHERE id = ?", [id]);
    conn.release();

    if (rows.length === 0) return res.status(404).json({ error: "Clase no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo detalle de clase" });
  }
};
