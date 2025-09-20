import { Router } from "express";
import {
  requestOtp,
  verifyOtp,
  confirmOtp,        // alias
  loginWithPassword, // opcional
  setPassword        // opcional (testing)
} from "../controllers/authController.js";

const router = Router();

// OTP
router.post("/request-otp", requestOtp);
router.post("/resend-otp", requestOtp);  // <— alias de reenvío
router.post("/verify-otp", verifyOtp);
router.post("/confirm-otp", confirmOtp); // alias para front

// user/password
router.post("/login", loginWithPassword);

// solo testing local (NO dejar en prod)
router.post("/set-password", setPassword);

export default router;
