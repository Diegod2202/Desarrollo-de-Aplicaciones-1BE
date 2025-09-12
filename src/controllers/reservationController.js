// reservationController.js — Gestión de reservas
// Cambios clave (comentado para revisión del equipo):
// 1) Se agrega validación de solapamiento de horarios ANTES de insertar.
//    - Mensaje nuevo y claro: 409 "Reserva se solapa con otra".
// 2) Se mantiene tu validación de cupo y tus mismos mensajes:
//    - 404 "Clase no encontrada"
//    - 400 "Cupo lleno"
// 3) NO se cambia el esquema de la DB ni los nombres de campos.
// 4) NO se tocan rutas ni nombres de funciones/exports para no romper integración.

import pool from "../config/db.js";

// POST /reservations
export const createReservation = async (req, res) => {
  try {
    const { class_id } = req.body;
    const userId = req.user.id; // viene del authMiddleware

    const conn = await pool.getConnection();

    // -- 1) Verificar que la clase exista (se mantiene tu mensaje) --------------
    const [classes] = await conn.execute(
      "SELECT id, fecha, hora, duracion, cupo FROM classes WHERE id = ?",
      [class_id]
    );
    if (classes.length === 0) {
      conn.release();
      return res.status(404).json({ error: "Clase no encontrada" });
    }
    const clase = classes[0];

    // -- 2) NUEVO: validar solapamiento de horarios para el usuario ------------
    // Calculamos el rango de la clase actual con fecha + hora + duracion.
    // Buscamos si el usuario tiene otra reserva CONFIRMADA que se superponga.
    // Condición de NO solapamiento:
    //    existing_end <= new_start  OR  existing_start >= new_end
    // Por ende, solapa si NO se cumple esa condición.
    const [overlap] = await conn.execute(
      `
      SELECT r.id
        FROM reservations r
        JOIN classes c ON c.id = r.class_id
       WHERE r.user_id = ?
         AND r.status = 'confirmada'
         AND NOT (
           DATE_ADD(TIMESTAMP(c.fecha, c.hora), INTERVAL c.duracion MINUTE) <= DATE_ADD(TIMESTAMP(?, ?), INTERVAL ? MINUTE)
           OR TIMESTAMP(c.fecha, c.hora) >= TIMESTAMP(?, ?)
         )
       LIMIT 1
      `,
      // Parámetros: userId, new_start(fecha,hora,duracion para end), new_start(fecha,hora)
      [userId, clase.fecha, clase.hora, clase.duracion, clase.fecha, clase.hora]
    );

    if (overlap.length > 0) {
      conn.release();
      // Mensaje nuevo claro para el cliente; status 409 = conflicto de negocio
      return res.status(409).json({ error: "Reserva se solapa con otra" });
    }

    // -- 3) Validar cupo (se mantiene tu lógica y mensaje) ---------------------
    const [reservations] = await conn.execute(
      "SELECT COUNT(*) as total FROM reservations WHERE class_id = ? AND status = 'confirmada'",
      [class_id]
    );
    if (reservations[0].total >= clase.cupo) {
      conn.release();
      return res.status(400).json({ error: "Cupo lleno" });
    }

    // -- 4) Insertar reserva (se mantiene igual) --------------------------------
    const [result] = await conn.execute(
      "INSERT INTO reservations (user_id, class_id, status) VALUES (?, ?, 'confirmada')",
      [userId, class_id]
    );

    conn.release();
    return res.json({ message: "Reserva creada", reservationId: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error creando reserva" });
  }
};

// DELETE /reservations/:id  (SIN CAMBIOS)
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

// GET /reservations/me  (SIN CAMBIOS)
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
