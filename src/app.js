// app.js — Punto de entrada del servidor Express
// Objetivo: exponer /api con respuestas JSON consistentes y manejar errores de forma clara.

import express from "express";           // Framework HTTP
import dotenv from "dotenv";             // Carga variables de entorno desde .env
import cors from "cors";                 // Habilita CORS para que el frontend Android pueda consumir la API
import routes from "./routes/index.js";  // Router principal con las rutas de tu app

// 1) Cargar variables de entorno (.env)
dotenv.config();

// 2) Crear instancia de la app
const app = express();

// 3) Configurar CORS básico
//    Comentario: permitimos que la app móvil haga requests; si después querés restringir orígenes, lo ajustamos.
app.use(cors());

// 4) Parsear JSON del body
//    Comentario: sin esto, req.body vendría vacío en POST/PUT con JSON.
app.use(express.json());

// 5) Montar las rutas de la API bajo /api
//    Comentario: todo lo que esté en routes/index.js cuelga de /api (ej: /api/auth, /api/classes, etc.)
app.use("/api", routes);

// 6) Middleware 404 (rutas no encontradas)
//    Comentario: si alguien pide un endpoint inexistente, devolvemos JSON legible en vez de HTML genérico.
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",     // Se informa el tipo de error
    path: req.originalUrl,  // Se muestra qué ruta pidió el cliente (ayuda a debuggear)
    method: req.method      // Método HTTP usado
  });
});

// 7) Middleware de manejo de errores (try/catch central)
//    Comentario: cualquier excepción que llegue acá responde con JSON consistente.
//    - En producción ocultamos el stacktrace; en desarrollo lo mostramos para diagnosticar.
app.use((err, req, res, next) => {
  // Si un controlador setea err.status (ej: 400/401/409), usamos ese; si no, 500.
  const status = err.status || 500;

  // Mensaje para el cliente: claro y corto.
  const payload = { error: err.message || "Internal Server Error" };

  // Solo en entorno no productivo devolvemos el stack para facilitar el debug (no exponer en prod).
  if (process.env.NODE_ENV !== "production" && err.stack) {
    payload.stack = err.stack;
  }

  // Log server-side (opcional): acá podrías agregar un logger tipo pino/winston
  // console.error(err);

  // Respuesta final
  res.status(status).json(payload);
});

// 8) Levantar el servidor en el puerto asignado
//    Comentario: PORT configurable por .env; si no existe, usamos 4000 por defecto.
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
