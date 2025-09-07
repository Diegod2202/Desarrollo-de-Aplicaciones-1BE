import { Router } from "express";
import { requestOtp, verifyOtp } from "../controllers/authController.js";

const router = Router();

// Solicitar OTP
router.post("/request-otp", requestOtp);

// Verificar OTP
router.post("/verify-otp", verifyOtp);

export default router;
