import pool from "../config/db.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const OTP_TTL_MIN = 5;            // minutos
const JWT_TTL = "7d";             // duración del token
const norm = (e) => (e || "").trim().toLowerCase();
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

/* ========= Email (Gmail) ========= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function sendOtpEmail(to, code) {
  await transporter.sendMail({
    from: `"RitmoFit" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Tu código de acceso a RitmoFit",
    text: `Tu código OTP es: ${code} (válido por ${OTP_TTL_MIN} minutos).`,
  });
}

/* ========= JWT ========= */
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: JWT_TTL });
}

/* ===================== OTP ===================== */

/**
 * Crea un OTP y lo envía por email.
 * Si el usuario no existe, se creará recién en verifyOtp (registro por OTP).
 */
export const requestOtp = async (req, res) => {
  try {
    const email = norm(req.body.email);
    if (!email) return res.status(400).json({ error: "Email requerido" });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

    const conn = await pool.getConnection();
    try {
      await conn.execute(
        "INSERT INTO otps (email, code, expires_at) VALUES (?, ?, ?)",
        [email, code, expiresAt]
      );
    } finally {
      conn.release();
    }

    await sendOtpEmail(email, code);
    res.json({ message: "OTP enviado al correo" });
  } catch (err) {
    console.error("requestOtp error:", err);
    res.status(500).json({ error: "Error solicitando OTP" });
  }
};

/**
 * Verifica OTP. Si el usuario no existe lo crea (registro por OTP).
 * Devuelve token + user + flag hasPassword para guiar el flujo de “crear contraseña”.
 */
export const verifyOtp = async (req, res) => {
  try {
    const email = norm(req.body.email);
    const { code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email y OTP requeridos" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        "SELECT * FROM otps WHERE email = ? AND code = ? ORDER BY id DESC LIMIT 1",
        [email, code]
      );
      if (rows.length === 0) return res.status(400).json({ error: "OTP inválido" });

      const otp = rows[0];
      if (new Date(otp.expires_at) < new Date()) {
        return res.status(400).json({ error: "OTP expirado" });
      }

      // Usuario: crear si no existe
      const [userRows] = await conn.execute("SELECT * FROM users WHERE email = ?", [email]);
      let user, hasPassword;
      if (userRows.length === 0) {
        const name = email.split("@")[0];
        const [result] = await conn.execute(
          "INSERT INTO users (email, name) VALUES (?, ?)",
          [email, name]
        );
        user = { id: result.insertId, email, name };
        hasPassword = false;
      } else {
        const u = userRows[0];
        user = { id: u.id, email: u.email, name: u.name };
        hasPassword = !!u.password;
      }

      // Limpiar OTP usado (opcional pero recomendado)
      await conn.execute("DELETE FROM otps WHERE id = ?", [otp.id]);

      const token = signToken(user);
      res.json({ message: "Login por OTP exitoso", token, user: { ...user, hasPassword } });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("verifyOtp error:", err);
    res.status(500).json({ error: "Error verificando OTP" });
  }
};

// Reenvío simple (genera un OTP nuevo y lo envía)
export const resendOtp = async (req, res) => {
  try {
    req.body.email = norm(req.body.email);
    if (!req.body.email) return res.status(400).json({ error: "Email requerido" });
    return requestOtp(req, res);
  } catch (err) {
    console.error("resendOtp error:", err);
    res.status(500).json({ error: "Error reenviando OTP" });
  }
};

/* ============== User/Password ============== */

/**
 * Registro explícito con email+password (hashea bcrypt).
 * (Opcional: con OTP ya tenés registro; dejalo por si querés alta directa con pass.)
 */
export const register = async (req, res) => {
  try {
    const email = norm(req.body.email);
    const { name, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email y password requeridos" });

    const conn = await pool.getConnection();
    try {
      const [exist] = await conn.execute("SELECT id FROM users WHERE email = ?", [email]);
      if (exist.length > 0) {
        return res.status(409).json({ error: "El email ya está registrado" });
      }

      const hash = await bcrypt.hash(password, 10);
      const finalName = name || email.split("@")[0];

      const [result] = await conn.execute(
        "INSERT INTO users (email, name, password) VALUES (?, ?, ?)",
        [email, finalName, hash]
      );

      const user = { id: result.insertId, email, name: finalName };
      const token = signToken(user);
      res.status(201).json({ message: "Usuario registrado", token, user: { ...user, hasPassword: true } });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ error: "Error registrando usuario" });
  }
};

/**
 * Login tradicional con email+password (bcrypt.compare)
 */
export const loginWithPassword = async (req, res) => {
  try {
    const email = norm(req.body.email);
    const { password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email y password requeridos" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute("SELECT * FROM users WHERE email = ?", [email]);
      if (rows.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

      const u = rows[0];
      if (!u.password) {
        return res.status(403).json({ error: "Este usuario no tiene password. Ingresá por OTP y configurá uno." });
      }

      const ok = await bcrypt.compare(password, u.password);
      if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

      // ✅ Generar y guardar OTP automático
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);

      await conn.execute(
        "INSERT INTO otps (email, code, expires_at) VALUES (?, ?, ?)",
        [email, otp, expiresAt]
      );

      // ✅ Enviar OTP por email
      await sendOtpEmail(email, otp);

      // Devolvemos solo el user, sin token aún
      const user = { id: u.id, email: u.email, name: u.name };
      res.json({
        message: "Código OTP enviado al correo",
        user: { ...user, hasPassword: true },
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Error en login" });
  }
};

/**
 * Setea/actualiza password para el usuario logueado (flujo post-OTP).
 * Requiere authMiddleware (JWT) en la ruta.
 */
export const setPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: "Password requerido" });

    const hash = await bcrypt.hash(newPassword, 10);

    const conn = await pool.getConnection();
    try {
      await conn.execute("UPDATE users SET password = ? WHERE id = ?", [hash, req.user.id]);
      res.json({ message: "Password actualizado" });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("setPassword error:", e);
    res.status(500).json({ error: "No se pudo actualizar el password" });
  }
};

/* ============== Utilidad protegida ============== */

/**
 * Devuelve el usuario actual (con flag hasPassword).
 */
export const me = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      "SELECT id, email, name, password FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });

    const u = rows[0];
    res.json({ user: { id: u.id, email: u.email, name: u.name, hasPassword: !!u.password } });
  } catch (e) {
    console.error("me error:", e);
    res.status(500).json({ error: "No se pudo obtener el usuario" });
  } finally {
    conn.release();
  }
};
