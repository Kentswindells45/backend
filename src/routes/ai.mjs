import express from "express";
import { chat } from "../controllers/aiController.mjs";
import { authorize } from "../middleware/auth.mjs";

const router = express.Router();
// Protect AI endpoint so only authenticated users can call it
router.post("/", authorize, chat);

export default router;
