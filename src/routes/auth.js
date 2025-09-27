import { Router } from "express";
import {
  // Login / OTP
  requestOtp,
  verifyOtp,
  resendOtp,
  loginWithPassword,
  setPassword,
  me,
  checkEmail,

  // Recuperación
  requestPasswordReset,
  confirmPasswordReset,

  // Registro
  registerRequestOtp,
  registerVerifyOtp,
  registerComplete,
} from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

/* ===== Login / OTP ===== */
router.get("/check-email", checkEmail);
router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", loginWithPassword);

/* ===== Password & Perfil ===== */
router.post("/set-password", authMiddleware, setPassword);
router.get("/me", authMiddleware, me);

/* ===== Recuperación de contraseña ===== */
router.post("/recover/request", requestPasswordReset);
router.post("/recover/confirm", confirmPasswordReset);

/* ===== Registro por OTP ===== */
router.post("/register/request-otp", registerRequestOtp);
router.post("/register/verify-otp", registerVerifyOtp);
router.post("/register/complete", registerComplete);

export default router;
