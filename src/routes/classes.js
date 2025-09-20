import { Router } from "express";
import { getClasses, getClassById } from "../controllers/classController.js";

const router = Router();

router.get("/", getClasses);      // público
router.get("/:id", getClassById); // público

export default router;
