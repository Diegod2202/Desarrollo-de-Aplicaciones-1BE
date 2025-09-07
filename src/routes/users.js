import { Router } from "express";
import { getProfile, updateProfile } from "../controllers/userController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Obtener perfil
router.get("/me", authMiddleware, getProfile);

// Actualizar perfil
router.put("/me", authMiddleware, updateProfile);

export default router;
