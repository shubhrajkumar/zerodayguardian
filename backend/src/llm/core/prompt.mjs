const MAX_CACHE_ITEMS = 120;
const PROMPT_SCHEMA_VERSION = "zorvix-v9";
const promptCache = new Map();

const toKey = (topic, profile) =>
  JSON.stringify({
    version: PROMPT_SCHEMA_VERSION,
    topic: {
      title: String(topic?.title || "").slice(0, 80),
      tags: Array.isArray(topic?.tags) ? topic.tags.slice(0, 6).map((tag) => String(tag).slice(0, 24)) : [],
    },
    profile: {
      tone: profile?.tone || "professional",
      style: profile?.style || "balanced",
      audience: profile?.audience || "general",
      expressiveness: Number.isFinite(Number(profile?.expressiveness)) ? Number(profile?.expressiveness) : 1,
    },
  });

const setCache = (key, value) => {
  if (promptCache.has(key)) promptCache.delete(key);
  promptCache.set(key, value);
  if (promptCache.size > MAX_CACHE_ITEMS) {
    const oldest = promptCache.keys().next().value;
    if (oldest) promptCache.delete(oldest);
  }
};

export const buildSystemPrompt = (topic, assistantProfile = null) => {
  const cacheKey = toKey(topic, assistantProfile);
  const cached = promptCache.get(cacheKey);
  if (cached) return cached;

  const context = topic
    ? `Active topic: ${String(topic.title || "").slice(0, 80)}. Focus tags: ${(Array.isArray(topic.tags) ? topic.tags.slice(0, 6) : []).join(", ")}.`
    : "No topic selected. Ask clarifying questions when useful.";
  const tone = assistantProfile?.tone || "professional";
  const style = assistantProfile?.style || "balanced";
  const audience = assistantProfile?.audience || "general";
  const expressiveness = Number.isFinite(Number(assistantProfile?.expressiveness))
    ? Number(assistantProfile?.expressiveness)
    : 1;

  const prompt = [
    "You are Zorvix, a versatile AI assistant for Zero Day Guardian.",
    "Always reply to every user message with a helpful, safe answer or a short clarifying question.",
    "Be flexible and answer any general question unless it is unsafe or disallowed.",
    "Adapt to user intent first. Do not force cybersecurity content.",
    "Only switch into cybersecurity expert mode when the request is clearly security-related.",
    "Default to a general assistant for technology, programming, learning, research, and everyday questions.",
    "If attachments are present, analyze them first and use the extracted file context in your answer.",
    "If no attachments exist, do not claim file analysis.",
    "Never call yourself NeuroBot, Zorvex, or any other name.",
    "Tone: professional, friendly, concise, and practical.",
    "Use whatever response structure best fits the question (short answer, bullets, or steps).",
    "Use bold for important terms and keep the response easy to scan.",
    "Avoid long paragraphs and raw error dumps. Convert issues into clear guidance.",
    "If the request is unclear, ask a single clarifying question.",
    "Only provide legal, defensive, or authorized security guidance when in cybersecurity mode.",
    `Tone target: ${tone}. Detail style: ${style}. Primary audience: ${audience}.`,
    `Expressiveness level: ${expressiveness}. Keep output warm and focused.`,
    "Maintain natural conversational flow and multi-turn context.",
    context,
  ].join(" ");

  setCache(cacheKey, prompt);
  return prompt;
};

export const clearSystemPromptCache = () => {
  promptCache.clear();
};
