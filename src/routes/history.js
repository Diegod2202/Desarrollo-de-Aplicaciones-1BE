import { Router } from "express";
import { getHistory } from "../controllers/historyController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Historial de asistencias del usuario logueado (con filtros opcionales ?from=YYYY-MM-DD&to=YYYY-MM-DD)
router.get("/", authMiddleware, getHistory);

export default router;
