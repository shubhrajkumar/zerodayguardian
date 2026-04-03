import { logError } from "../../src/utils/logger.mjs";
import { runChat } from "../services/chatService.js";

export const postChat = async (req, res, next) => {
  try {
    const { message } = req.body || {};
    const result = await runChat({ message, requestId: req.requestId || "" });
    res.status(200).json({
      success: true,
      reply: result.reply || "",
      timestamp: Date.now(),
    });
  } catch (error) {
    logError("/api/chat failed", error, {
      requestId: req.requestId || "",
      path: req.originalUrl || req.path,
    });
    const status = Number(error?.status || 500);
    res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      error: String(error?.message || "Failed to generate mentor response"),
    });
  }
};
