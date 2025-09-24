import jwt from "jsonwebtoken";

/**
 * Valida el JWT y deja { id, email } en req.user
 */
export const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Token requerido" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Solo exponemos lo necesario
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};
