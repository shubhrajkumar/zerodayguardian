export const synthesizeCalmSpeech = async (aiResponse = "") => {
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
  if (!GOOGLE_API_KEY) {
    const error = new Error("GOOGLE_API_KEY is missing.");
    error.status = 500;
    throw error;
  }

  const normalizeGroundedText = (text) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "I am here. Please ask again clearly.";
    const short = clean
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(" ")
      .slice(0, 320)
      .trim();
    return short || clean.slice(0, 320);
  };

  const containsHindi = /[\u0900-\u097F]/.test(aiResponse);
  const aiText = normalizeGroundedText(aiResponse);

  const neural2Voice = containsHindi
    ? { languageCode: "hi-IN", name: "hi-IN-Neural2-A" }
    : { languageCode: "en-US", name: "en-US-Neural2-D" };

  const waveNetVoice = containsHindi
    ? { languageCode: "hi-IN", name: "hi-IN-Wavenet-A" }
    : { languageCode: "en-US", name: "en-US-Wavenet-D" };

  const buildRequest = (selectedVoiceConfig) => ({
    input: { text: aiText },
    voice: selectedVoiceConfig,
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: 0.88,
      pitch: 0.0,
    },
  });

  const callGoogleTts = async (selectedVoiceConfig) => {
    const request = buildRequest(selectedVoiceConfig);
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(GOOGLE_API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_API_KEY,
        },
        body: JSON.stringify(request),
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.audioContent) {
      const error = new Error(payload?.error?.message || `Google TTS failed (${response.status})`);
      error.status = response.status || 500;
      error.payload = payload;
      throw error;
    }
    return {
      audioContentBase64: payload.audioContent,
      mimeType: "audio/mpeg",
      voiceUsed: selectedVoiceConfig.name,
      languageCode: selectedVoiceConfig.languageCode,
      speakingRate: 0.88,
      pitch: 0.0,
      text: aiText,
    };
  };

  try {
    return await callGoogleTts(neural2Voice);
  } catch (error) {
    const code = Number(error?.status || 0);
    if (code === 400 || code === 404 || code === 429 || code >= 500) {
      return callGoogleTts(waveNetVoice);
    }
    throw error;
  }
};
