import { Router } from "express";
import { postChat } from "../controllers/chatController.js";
import { chatRateLimit } from "../../src/middleware/rateLimit.mjs";

const router = Router();

router.post("/chat", chatRateLimit, postChat);

export default router;
