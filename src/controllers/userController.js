// src/controllers/userController.js
import pool from "../config/db.js";

/**
 * GET /api/users/me
 * Devuelve el perfil del usuario autenticado (sacado de req.user por el authMiddleware).
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const [rows] = await pool.execute(
      "SELECT id, name, email, photo FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
};

/**
 * PUT /api/users/me
 * Actualiza perfil. Si algún campo no viene, se preserva el valor anterior.
 * - undefined -> se convierte a null para no romper MySQL2.
 * - COALESCE(?, campo) mantiene el valor existente cuando el param es null.
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Normalizamos: undefined -> null (MySQL2 NO acepta undefined)
    const normalize = (v) => (v === undefined ? null : v);

    // Campos permitidos a actualizar (ajustá según tu schema)
    const name = normalize(req.body?.name);
    const email = normalize(req.body?.email); // si NO querés permitir cambiar email, dejalo fijo a null
    const photo = normalize(req.body?.photo);

    // Si no vino ningún campo, simplemente devolvemos el perfil actual
    if (name === null && email === null && photo === null) {
      const [rows] = await pool.execute(
        "SELECT id, name, email, photo FROM users WHERE id = ? LIMIT 1",
        [userId]
      );
      return res.json(rows[0] || {});
    }

    // Usamos COALESCE para mantener el valor previo cuando el parámetro es null
    // Si NO querés permitir actualizar el email, reemplazá COALESCE(?, email) por email (o quitalo del UPDATE)
    const [result] = await pool.execute(
      `
        UPDATE users
        SET
          name  = COALESCE(?, name),
          email = COALESCE(?, email),
          photo = COALESCE(?, photo)
        WHERE id = ?
      `,
      [name, email, photo, userId]
    );

    // Devolvemos el registro actualizado
    const [rows] = await pool.execute(
      "SELECT id, name, email, photo FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    return res.json(rows[0] || {});
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
};
