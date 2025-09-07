import pool from "../config/db.js";

// GET /users/me
export const getProfile = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute("SELECT id, name, email, photo FROM users WHERE id = ?", [req.user.id]);
    conn.release();

    if (rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo perfil" });
  }
};

// PUT /users/me
export const updateProfile = async (req, res) => {
  try {
    const { name, photo } = req.body;

    const conn = await pool.getConnection();
    await conn.execute(
      "UPDATE users SET name = ?, photo = ? WHERE id = ?",
      [name, photo, req.user.id]
    );
    const [rows] = await conn.execute("SELECT id, name, email, photo FROM users WHERE id = ?", [req.user.id]);
    conn.release();

    res.json({ message: "Perfil actualizado", user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando perfil" });
  }
};
