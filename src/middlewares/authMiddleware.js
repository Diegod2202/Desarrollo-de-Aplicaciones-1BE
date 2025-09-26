import jwt from "jsonwebtoken";

/**
 * authMiddleware
 * Valida Authorization: Bearer <token>, verifica la firma y adjunta req.user.
 * Rechaza si falta el header, el token está mal formateado, el secret no existe,
 * la firma es inválida o el payload no trae un id.
 */
export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: "Token Bearer requerido" });
    }

    const token = match[1].trim();
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Mejor fallar explícito si no hay secret configurado
      return res.status(500).json({ error: "JWT_SECRET no configurado en el servidor" });
    }

    // Verificamos firma y expiración
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"], // ajustá si usás otro algoritmo
      // clockTolerance: 5 // opcional, tolerancia de reloj en segundos
    });

    // Validación mínima del payload
    if (!decoded || typeof decoded.id !== "number") {
      return res.status(401).json({ error: "Token inválido: payload sin 'id'" });
    }

    // Evitamos propagar claims no necesarios
    req.user = {
      id: decoded.id,
      email: decoded.email ?? null,
      role: decoded.role ?? "user",
    };

    return next();
  } catch (err) {
    // Token expirado, firma inválida, etc.
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};
