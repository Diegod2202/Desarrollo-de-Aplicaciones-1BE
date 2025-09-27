import pool from "../config/db.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

/* ================== Config ================== */
const OTP_TTL_MIN = 5; // Vigencia OTP (min)
const JWT_TTL = "7d"; // Duración del JWT

const norm = (e) => (e || "").trim().toLowerCase();
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/* ================== Email ================== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function sendEmail(to, subject, text) {
  await transporter.sendMail({
    from: `"RitmoFit" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  });
}

/* ================== JWT ================== */
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: JWT_TTL,
  });
}

/* =========================================================
   CHEQUEO DE EMAIL (paso 1 del login)
   ========================================================= */
export const checkEmail = async (req, res) => {
  try {
    const email = norm(req.query.email);
    if (!email) return res.status(400).json({ error: "Email requerido" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email]
      );
      return res.json({ exists: rows.length > 0 });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("checkEmail error:", err);
    res.status(500).json({ error: "Error verificando email" });
  }
};

/* =========================================================
   LOGIN: OTP base (request / verify / resend)
   ========================================================= */
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

    await sendEmail(
      email,
      "Código de acceso",
      `Tu código es: ${code} (válido por ${OTP_TTL_MIN} minutos).`
    );
    res.json({ message: "OTP enviado al correo" });
  } catch (err) {
    console.error("requestOtp error:", err);
    res.status(500).json({ error: "Error solicitando OTP" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const email = norm(req.body.email);
    const { code } = req.body;
    if (!email || !code)
      return res.status(400).json({ error: "Email y OTP requeridos" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        "SELECT * FROM otps WHERE email = ? AND code = ? ORDER BY id DESC LIMIT 1",
        [email, code]
      );
      if (rows.length === 0)
        return res.status(400).json({ error: "OTP inválido" });
      const otp = rows[0];
      if (new Date(otp.expires_at) < new Date())
        return res.status(400).json({ error: "OTP expirado" });

      // Buscar usuario; si no existe, crearlo con datos mínimos
      const [userRows] = await conn.execute(
        "SELECT * FROM users WHERE email = ?",
        [email]
      );
      let user,
        hasPassword = false;
      if (userRows.length === 0) {
        const name = email.split("@")[0];
        const [r] = await conn.execute(
          "INSERT INTO users (name, email) VALUES (?, ?)",
          [name, email]
        );
        user = { id: r.insertId, email, name };
        hasPassword = false;
      } else {
        const u = userRows[0];
        user = { id: u.id, email: u.email, name: u.name };
        hasPassword = !!u.password;
      }

      await conn.execute("DELETE FROM otps WHERE id = ?", [otp.id]);

      const token = signToken(user);
      res.json({
        message: "Login por OTP exitoso",
        token,
        user: { ...user, hasPassword },
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("verifyOtp error:", err);
    res.status(500).json({ error: "Error verificando OTP" });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const email = norm(req.body.email);
    if (!email) return res.status(400).json({ error: "Email requerido" });
    return requestOtp(req, res);
  } catch (err) {
    console.error("resendOtp error:", err);
    res.status(500).json({ error: "Error reenviando OTP" });
  }
};

/* =========================================================
   LOGIN con password
   ========================================================= */
export const loginWithPassword = async (req, res) => {
  try {
    const email = norm(req.body.email);
    const { password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email y password requeridos" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute("SELECT * FROM users WHERE email = ?", [
        email,
      ]);
      if (rows.length === 0)
        return res.status(401).json({ error: "Credenciales inválidas" });

      const u = rows[0];
      if (!u.password)
        return res
          .status(403)
          .json({ error: "Este usuario no tiene password" });

      const ok = await bcrypt.compare(password, u.password);
      if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

      const user = { id: u.id, email: u.email, name: u.name };
      const token = signToken(user);
      res.json({
        message: "Login exitoso",
        token,
        user: { ...user, hasPassword: true },
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("loginWithPassword error:", err);
    res.status(500).json({ error: "Error en login" });
  }
};

/* =========================================================
   SET PASSWORD (requiere JWT)
   ========================================================= */
export const setPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword)
      return res.status(400).json({ error: "Password requerido" });

    const hash = await bcrypt.hash(newPassword, 10);
    const conn = await pool.getConnection();
    try {
      await conn.execute("UPDATE users SET password = ? WHERE id = ?", [
        hash,
        req.user.id,
      ]);
      res.json({ message: "Password actualizado" });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("setPassword error:", e);
    res.status(500).json({ error: "No se pudo actualizar el password" });
  }
};

/* =========================================================
   RECUPERACIÓN DE PASSWORD (email → OTP → new pass)
   ========================================================= */
export const requestPasswordReset = async (req, res) => {
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

    await sendEmail(
      email,
      "Recuperación de contraseña",
      `Tu código es: ${code} (válido ${OTP_TTL_MIN} min).`
    );
    res.json({ message: "Código enviado" });
  } catch (err) {
    console.error("requestPasswordReset error:", err);
    res.status(500).json({ error: "No se pudo enviar el código" });
  }
};

export const confirmPasswordReset = async (req, res) => {
  try {
    const email = norm(req.body.email);
    const { code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res
        .status(400)
        .json({ error: "Email, código y nueva contraseña requeridos" });
    }

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        "SELECT * FROM otps WHERE email = ? AND code = ? ORDER BY id DESC LIMIT 1",
        [email, code]
      );
      if (rows.length === 0)
        return res.status(400).json({ error: "Código inválido" });
      const otp = rows[0];
      if (new Date(otp.expires_at) < new Date())
        return res.status(400).json({ error: "Código expirado" });

      const hash = await bcrypt.hash(newPassword, 10);
      await conn.execute("UPDATE users SET password = ? WHERE email = ?", [
        hash,
        email,
      ]);

      await conn.execute("DELETE FROM otps WHERE id = ?", [otp.id]);
      res.json({ message: "Contraseña actualizada" });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("confirmPasswordReset error:", err);
    res.status(500).json({ error: "No se pudo actualizar la contraseña" });
  }
};

/* =========================================================
   REGISTRO POR OTP (pasos 2–4)
   ========================================================= */
// Paso 2: enviar OTP (si ya existe el email, 409)
export const registerRequestOtp = async (req, res) => {
  try {
    const email = norm(req.body.email);
    if (!email) return res.status(400).json({ error: "Email requerido" });

    const conn = await pool.getConnection();
    try {
      const [exists] = await conn.execute(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email]
      );
      if (exists.length > 0)
        return res.status(409).json({ error: "El email ya está registrado" });

      const code = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);
      await conn.execute(
        "INSERT INTO otps (email, code, expires_at) VALUES (?, ?, ?)",
        [email, code, expiresAt]
      );

      await sendEmail(
        email,
        "Verificación de email (registro)",
        `Tu código es: ${code} (válido ${OTP_TTL_MIN} min).`
      );
      res.json({ message: "Enviamos un código a tu email" });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("registerRequestOtp error:", err);
    res.status(500).json({ error: "No se pudo enviar el código" });
  }
};

// Paso 3: verificar OTP (no loguea)
export const registerVerifyOtp = async (req, res) => {
  try {
    const email = norm(req.body.email);
    const { code } = req.body;
    if (!email || !code)
      return res.status(400).json({ error: "Email y código requeridos" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        "SELECT * FROM otps WHERE email = ? AND code = ? ORDER BY id DESC LIMIT 1",
        [email, code]
      );
      if (rows.length === 0)
        return res.status(400).json({ error: "Código inválido" });
      const otp = rows[0];
      if (new Date(otp.expires_at) < new Date())
        return res.status(400).json({ error: "Código expirado" });

      await conn.execute("DELETE FROM otps WHERE id = ?", [otp.id]);
      res.json({ message: "Email verificado" });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("registerVerifyOtp error:", err);
    res.status(500).json({ error: "No se pudo verificar el código" });
  }
};

// Paso 4: completar datos y crear usuario (NO loguea)
export const registerComplete = async (req, res) => {
  try {
    const email = norm(req.body.email);
    const { name, password, photo } = req.body; // photo opcional según tu schema
    if (!email || !name || !password)
      return res
        .status(400)
        .json({ error: "Nombre, email y contraseña requeridos" });

    const conn = await pool.getConnection();
    try {
      const [exists] = await conn.execute(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email]
      );
      if (exists.length > 0)
        return res.status(409).json({ error: "El email ya está registrado" });

      const hash = await bcrypt.hash(password, 10);
      await conn.execute(
        "INSERT INTO users (name, email, photo, password) VALUES (?, ?, ?, ?)",
        [name, email, photo || null, hash]
      );

      res.status(201).json({ message: "Cuenta creada" });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("registerComplete error:", err);
    res.status(500).json({ error: "No se pudo crear la cuenta" });
  }
};

/* =========================================================
   PERFIL
   ========================================================= */
export const me = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      "SELECT id, email, name, password FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });

    const u = rows[0];
    res.json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        hasPassword: !!u.password,
      },
    });
  } catch (e) {
    console.error("me error:", e);
    res.status(500).json({ error: "No se pudo obtener el usuario" });
  } finally {
    conn.release();
  }
};
