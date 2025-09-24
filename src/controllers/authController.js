import pool from "../config/db.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const OTP_TTL_MIN = 5; // minutos
const JWT_TTL = "7d";

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(to, code) {
  await transporter.sendMail({
    from: `"RitmoFit" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Tu código de acceso a RitmoFit",
    text: `Tu código OTP es: ${code} (válido por ${OTP_TTL_MIN} minutos).`,
  });
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: JWT_TTL,
  });
}

/* ===================== OTP ===================== */

export const requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
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

export const verifyOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code)
      return res.status(400).json({ error: "Email y OTP requeridos" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        "SELECT * FROM otps WHERE email = ? AND code = ? ORDER BY id DESC LIMIT 1",
        [email, code]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: "OTP inválido" });
      }

      const otp = rows[0];
      if (new Date(otp.expires_at) < new Date()) {
        return res.status(400).json({ error: "OTP expirado" });
      }

      // Usuario: crear si no existe
      const [userRows] = await conn.execute("SELECT * FROM users WHERE email = ?", [email]);
      let user;
      if (userRows.length === 0) {
        const name = email.split("@")[0];
        const [result] = await conn.execute(
          "INSERT INTO users (email, name) VALUES (?, ?)",
          [email, name]
        );
        user = { id: result.insertId, email, name };
      } else {
        user = userRows[0];
      }

      // (opcional) limpiar OTP usado
      await conn.execute("DELETE FROM otps WHERE id = ?", [otp.id]);

      const token = signToken(user);
      res.json({ message: "Login por OTP exitoso", token, user });
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
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });
    // Reutilizamos requestOtp para no duplicar lógica
    return requestOtp(req, res);
  } catch (err) {
    console.error("resendOtp error:", err);
    res.status(500).json({ error: "Error reenviando OTP" });
  }
};

/* ============== User/Password ============== */

// Registro con user/password (hash con bcrypt)
export const register = async (req, res) => {
  try {
    const { email, name, password } = req.body;
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
      res.status(201).json({ message: "Usuario registrado", token, user });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ error: "Error registrando usuario" });
  }
};

// Login tradicional con user/password
export const loginWithPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email y password requeridos" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute("SELECT * FROM users WHERE email = ?", [email]);
      if (rows.length === 0 || !rows[0].password) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

      const token = signToken(user);
      // No exponer hash de password
      delete user.password;
      res.json({ message: "Login exitoso", token, user });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Error en login" });
  }
};

/* ============== Utilidad protegida ============== */

export const me = async (req, res) => {
  res.json({ user: req.user });
};
