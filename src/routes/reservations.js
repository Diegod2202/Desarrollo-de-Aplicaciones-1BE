import { Router } from "express";
import { createReservation, cancelReservation, getMyReservations } from "../controllers/reservationController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Crear reserva
router.post("/", authMiddleware, createReservation);

// Cancelar reserva
router.delete("/:id", authMiddleware, cancelReservation);

// Ver mis reservas próximas
router.get("/me", authMiddleware, getMyReservations);

export default router;
