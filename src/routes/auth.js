import { Router } from "express";
import {
  requestOtp,
  verifyOtp,
  resendOtp,
  register,
  loginWithPassword,
  setPassword,
  me,
} from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// OTP
router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// User/password
router.post("/register", register);
router.post("/login", loginWithPassword);

// Setear password (post-OTP) y perfil
router.post("/set-password", authMiddleware, setPassword);
router.get("/me", authMiddleware, me);

export default router;
