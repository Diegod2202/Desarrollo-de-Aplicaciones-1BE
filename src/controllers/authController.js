import pool from "../config/db.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// --- Solicitar OTP ---
export const requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    // Guardar en tabla otps
    const conn = await pool.getConnection();
    await conn.execute(
      "INSERT INTO otps (email, code, expires_at) VALUES (?, ?, ?)",
      [email, code, expiresAt]
    );
    conn.release();

    // Enviar mail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"RitmoFit" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Tu código de acceso a RitmoFit",
      text: `Tu código OTP es: ${code}`,
    });

    res.json({ message: "OTP enviado al correo" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error solicitando OTP" });
  }
};

// --- Verificar OTP ---
export const verifyOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email y OTP requeridos" });

    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      "SELECT * FROM otps WHERE email = ? AND code = ? ORDER BY id DESC LIMIT 1",
      [email, code]
    );

    if (rows.length === 0) {
      conn.release();
      return res.status(400).json({ error: "OTP inválido" });
    }

    const otp = rows[0];
    if (new Date(otp.expires_at) < new Date()) {
      conn.release();
      return res.status(400).json({ error: "OTP expirado" });
    }

    // Si no existe el usuario, lo creamos
    const [userRows] = await conn.execute("SELECT * FROM users WHERE email = ?", [email]);
    let user;
    if (userRows.length === 0) {
      const [result] = await conn.execute(
        "INSERT INTO users (email, name) VALUES (?, ?)",
        [email, email.split("@")[0]]
      );
      user = { id: result.insertId, email, name: email.split("@")[0] };
    } else {
      user = userRows[0];
    }

    // Generar JWT
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    conn.release();

    res.json({ message: "Login exitoso", token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error verificando OTP" });
  }
};
