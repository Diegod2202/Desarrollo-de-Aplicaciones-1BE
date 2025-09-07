import { Router } from "express";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import classRoutes from "./classes.js";
import reservationRoutes from "./reservations.js";
import historyRoutes from "./history.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "API RitmoFit funcionando" });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/classes", classRoutes);
router.use("/reservations", reservationRoutes);
router.use("/history", historyRoutes);

export default router;
