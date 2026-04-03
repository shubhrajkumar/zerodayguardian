import express from "express";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    console.log("🔥 User message:", message);

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3",
        prompt: message,
        stream: false
      })
    });

    const data = await response.json();

    console.log("🤖 AI response:", data.response);

    res.json({
      reply: data.response
    });

  } catch (err) {
    console.log("❌ ERROR:", err);
    res.json({
      reply: "⚠️ AI error, try again"
    });
  }
});

export default router;