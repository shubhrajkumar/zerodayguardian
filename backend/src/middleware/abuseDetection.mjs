const burstWindowMs = 5000;
const burstLimit = 6;
const history = new Map();

const suspicious = (text) => {
  const s = String(text || "").toLowerCase();
  if (s.length > 3800) return true;
  if (/(<script|javascript:|onerror=|onload=)/i.test(s)) return true;
  if (/(union\\s+select|drop\\s+table|insert\\s+into|delete\\s+from)/i.test(s)) return true;
  return false;
};

export const chatAbuseDetection = (req, res, next) => {
  if (req.path.endsWith("/stream") || req.path.endsWith("/stream/abort")) {
    next();
    return;
  }

  const key = `${req.ip}:${req.neurobotSessionId}`;
  const now = Date.now();
  const item = history.get(key) || { ts: [] };
  item.ts = item.ts.filter((time) => now - time < burstWindowMs);
  item.ts.push(now);
  history.set(key, item);

  if (item.ts.length > burstLimit) {
    res.status(429).json({ error: "Burst traffic detected. Please slow down." });
    return;
  }

  const text = req.body?.message || "";
  if (suspicious(text)) {
    res.status(400).json({ error: "Input rejected by security policy." });
    return;
  }

  next();
};
