import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import routes from "./routes/index.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Healthcheck básico
app.get("/", (_req, res) => {
  res.send("API RitmoFit funcionando 🚀");
});

// Todas las rutas agrupadas en /api
app.use("/api", routes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
