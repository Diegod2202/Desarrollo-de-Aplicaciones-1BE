import pool from "../config/db.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const OTP_TTL_MINUTES = 10;
const IS_DEV = (process.env.NODE_ENV || "development") === "development";

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

function buildTransporter() {
  const { EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
}

// POST /api/auth/request-otp  { email }
export const requestOtp = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email requerido" });

  const conn = await pool.getConnection();
  try {
    const code = generateOtp();
    const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await conn.execute("DELETE FROM otps WHERE email = ?", [email]);
    await conn.execute("INSERT INTO otps (email, code, expires_at) VALUES (?, ?, ?)", [
      email, code, expires
    ]);

    const transporter = buildTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: `"RitmoFit" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Tu código de acceso a RitmoFit",
        text: `Tu código OTP es: ${code} (vence en ${OTP_TTL_MINUTES} minutos)`,
      });
    }

    const payload = { message: "OTP generado" };
    if (IS_DEV) payload.dev_otp = code;
    payload.expires_at = expires;
    return res.json(payload);
  } catch (err) {
    console.error("requestOtp error:", err);
    return res.status(500).json({ error: "Error solicitando OTP" });
  } finally {
    conn.release();
  }
};

// POST /api/auth/verify-otp  { email, code }  (alias: /confirm-otp acepta { email, otp })
export const verifyOtp = async (req, res) => {
  const { email } = req.body || {};
  const code = req.body?.code ?? req.body?.otp;
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

    await conn.execute("DELETE FROM otps WHERE email = ?", [email]);

    const [userRows] = await conn.execute(
      "SELECT id, email, name FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    let user;
    if (userRows.length === 0) {
      const name = email.split("@")[0];
      const [ins] = await conn.execute(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        [name, email]
      );
      user = { id: ins.insertId, email, name };
    } else {
      user = userRows[0];
    }

    const token = signToken(user);
    return res.json({ message: "Login exitoso", token, user });
  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ error: "Error verificando OTP" });
  } finally {
    conn.release();
  }
};

// alias de compatibilidad
export const confirmOtp = verifyOtp;

// POST /api/auth/login  { email, password }  (opcional)
export const loginWithPassword = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email y password requeridos" });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      "SELECT id, email, name, password FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

    const u = rows[0];
    if (!u.password) return res.status(400).json({ error: "Usuario sin password. Usá OTP." });

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    const token = signToken(u);
    return res.json({ message: "Login exitoso", token, user: { id: u.id, email: u.email, name: u.name } });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Error en login" });
  } finally {
    conn.release();
  }
};

// POST /api/auth/set-password  { email, password }  (solo testing)
export const setPassword = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email y password requeridos" });

  const conn = await pool.getConnection();
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await conn.execute("UPDATE users SET password = ? WHERE email = ?", [hash, email]);
    if (r.affectedRows === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ message: "Password seteada" });
  } catch (err) {
    console.error("setPassword error:", err);
    return res.status(500).json({ error: "Error seteando password" });
  } finally {
    conn.release();
  }
};
