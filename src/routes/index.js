import { Router } from "express";
import classesRoutes from "./classes.js";
import reservationsRoutes from "./reservations.js";
import historyRoutes from "./history.js";
// si ya tienen auth por OTP
// import authRoutes from "./auth.js";

const router = Router();

// Modularización de rutas
router.use("/classes", classesRoutes);
router.use("/reservations", reservationsRoutes);
router.use("/history", historyRoutes);
// router.use("/auth", authRoutes);

export default router;
