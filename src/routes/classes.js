import { Router } from "express";
import { getClasses, getClassById } from "../controllers/classController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Listado con filtros
router.get("/", authMiddleware, getClasses);

// Detalle de clase
router.get("/:id", authMiddleware, getClassById);

export default router;
