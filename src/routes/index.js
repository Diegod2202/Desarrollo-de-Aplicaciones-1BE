import { Router } from "express";
import classesRoutes from "./classes.js";
import reservationsRoutes from "./reservations.js";
import historyRoutes from "./history.js";

const router = Router();

router.use("/classes", classesRoutes);          // público
router.use("/reservations", reservationsRoutes); // protegido en cada ruta
router.use("/history", historyRoutes);           // protegido en cada ruta

export default router;
