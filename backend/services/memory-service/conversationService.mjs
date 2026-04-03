import { getDb } from "../../src/config/db.mjs";
import { env } from "../../src/config/env.mjs";

const COLLECTION = "conversations";
const memoryConversations = new Map();
const canFallbackToMemory = () => env.nodeEnv !== "production";

const defaultAssistantProfile = Object.freeze({
  voiceId: "auto",
  voiceLabel: "Auto Voice",
  voiceGender: "unknown",
  accent: "global",
  tone: "friendly",
  style: "balanced",
  audience: "general",
  expressiveness: 1,
  speechRate: 1,
  pitch: 1,
  transport: "auto",
  privateMode: false,
});

const normalizeAssistantProfile = (profile = null) => ({
  ...defaultAssistantProfile,
  ...(profile || {}),
});

const normalizeConversation = (conversation) => ({
  ...(conversation || {}),
  assistantProfile: normalizeAssistantProfile(conversation?.assistantProfile),
});

const LEGACY_WELCOME_PATTERNS = [/##\s*zorvix online/i, /elite ethical hacking mentor ready/i];

const isLegacyWelcomeMessage = (message) => {
  const text = String(message?.content || "");
  return message?.role === "assistant" && LEGACY_WELCOME_PATTERNS.some((pattern) => pattern.test(text));
};

const isLegacyDefaultProfile = (profile = null) => {
  const candidate = profile || {};
  return (
    candidate.voiceId === "auto" &&
    candidate.voiceLabel === "Auto Voice" &&
    candidate.voiceGender === "unknown" &&
    candidate.accent === "global" &&
    candidate.tone === "professional" &&
    candidate.style === "balanced" &&
    candidate.audience === "general" &&
    Number(candidate.expressiveness) === 1 &&
    Number(candidate.speechRate) === 1 &&
    Number(candidate.pitch) === 1 &&
    candidate.transport === "auto" &&
    candidate.privateMode === false
  );
};

const buildConversationMigrations = (conversation) => {
  const updates = {};
  const currentMessages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  if (currentMessages.length && isLegacyWelcomeMessage(currentMessages[0])) {
    const nextMessages = [...currentMessages];
    nextMessages[0] = createAssistantWelcome();
    updates.messages = nextMessages;
  }
  if (!conversation?.assistantProfile || isLegacyDefaultProfile(conversation.assistantProfile)) {
    updates.assistantProfile = normalizeAssistantProfile(conversation?.assistantProfile);
  }
  return updates;
};

const createAssistantWelcome = () => ({
  id: `assistant-${Date.now()}`,
  role: "assistant",
  content:
    "## Zorvix Online\n\nFriendly cybersecurity and AI mentor ready. Ask about security concepts, AI tools, labs, debugging, or learning roadmaps.",
  timestamp: Date.now(),
});

export const getOrCreateConversation = async ({ sessionId, userId = null }) => {
  try {
    const db = getDb();
    const collection = db.collection(COLLECTION);
    const existing = await collection.findOne({ sessionId });
    if (existing) {
      if (existing.userId && userId && existing.userId !== userId) {
        const error = new Error("Conversation ownership mismatch");
        error.status = 403;
        throw error;
      }
      if (!existing.userId && userId) {
        await collection.updateOne(
          { sessionId },
          { $set: { userId, updatedAt: Date.now(), assistantProfile: normalizeAssistantProfile(existing.assistantProfile) } }
        );
        const updated = await collection.findOne({ sessionId });
        const migrations = buildConversationMigrations(updated);
        if (Object.keys(migrations).length) {
          await collection.updateOne({ sessionId }, { $set: { ...migrations, updatedAt: Date.now() } });
          return normalizeConversation(await collection.findOne({ sessionId }));
        }
        return normalizeConversation(updated);
      }
      const migrations = buildConversationMigrations(existing);
      if (Object.keys(migrations).length) {
        await collection.updateOne(
          { sessionId },
          { $set: { ...migrations, updatedAt: Date.now() } }
        );
        return normalizeConversation(await collection.findOne({ sessionId }));
      }
      return normalizeConversation(existing);
    }

    const now = Date.now();
    const doc = {
      sessionId,
      userId,
      activeTopic: null,
      messages: [createAssistantWelcome()],
      lastGoodAssistantReply: "",
      assistantProfile: normalizeAssistantProfile(),
      createdAt: now,
      updatedAt: now,
    };
    await collection.insertOne(doc);
    return normalizeConversation(doc);
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const existing = memoryConversations.get(sessionId);
    if (existing) {
      if (existing.userId && userId && existing.userId !== userId) {
        const error = new Error("Conversation ownership mismatch");
        error.status = 403;
        throw error;
      }
      if (!existing.userId && userId) existing.userId = userId;
      const migrations = buildConversationMigrations(existing);
      Object.assign(existing, migrations);
      existing.updatedAt = Date.now();
      return normalizeConversation({ ...existing, messages: [...existing.messages] });
    }
    const now = Date.now();
    const doc = {
      sessionId,
      userId,
      activeTopic: null,
      messages: [createAssistantWelcome()],
      lastGoodAssistantReply: "",
      assistantProfile: normalizeAssistantProfile(),
      createdAt: now,
      updatedAt: now,
    };
    memoryConversations.set(sessionId, doc);
    return normalizeConversation({ ...doc, messages: [...doc.messages] });
  }
};

const getOwnerFilter = (sessionId, userId = null) =>
  userId ? { sessionId, $or: [{ userId }, { userId: null }, { userId: { $exists: false } }] } : { sessionId };

export const updateTopic = async ({ sessionId, userId = null, topic }) => {
  const now = Date.now();
  const contextMessage = {
    id: `assistant-${now}`,
    role: "assistant",
    content: `Context updated. Ask any question or continue with ${topic?.title ?? "this topic"}.`,
    timestamp: now,
  };
  try {
    const db = getDb();
    const collection = db.collection(COLLECTION);
    await collection.updateOne(
      getOwnerFilter(sessionId, userId),
      {
        $set: { activeTopic: topic, updatedAt: now },
        $push: { messages: contextMessage },
      }
    );
    return normalizeConversation(await collection.findOne(getOwnerFilter(sessionId, userId)));
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const convo = await getOrCreateConversation({ sessionId, userId });
    convo.activeTopic = topic;
    convo.updatedAt = now;
    convo.messages = [...(convo.messages || []), contextMessage].slice(-80);
    memoryConversations.set(sessionId, convo);
    return normalizeConversation({ ...convo, messages: [...convo.messages] });
  }
};

export const updateAssistantProfile = async ({ sessionId, userId = null, assistantProfile }) => {
  const now = Date.now();
  const normalized = normalizeAssistantProfile(assistantProfile);
  try {
    const db = getDb();
    const collection = db.collection(COLLECTION);
    await collection.updateOne(
      getOwnerFilter(sessionId, userId),
      {
        $set: {
          assistantProfile: normalized,
          updatedAt: now,
        },
      }
    );
    const updated = await collection.findOne(getOwnerFilter(sessionId, userId));
    return normalizeConversation(updated);
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const convo = await getOrCreateConversation({ sessionId, userId });
    convo.assistantProfile = normalized;
    convo.updatedAt = now;
    memoryConversations.set(sessionId, convo);
    return normalizeConversation({ ...convo, messages: [...(convo.messages || [])] });
  }
};

export const appendMessages = async ({ sessionId, userId = null, userMessage, assistantMessage, activeTopic }) => {
  const now = Date.now();
  try {
    const db = getDb();
    const collection = db.collection(COLLECTION);
    await collection.updateOne(
      getOwnerFilter(sessionId, userId),
      {
        $set: {
          activeTopic: activeTopic ?? null,
          updatedAt: now,
          lastGoodAssistantReply: assistantMessage.content,
        },
        $push: {
          messages: {
            $each: [userMessage, assistantMessage],
            $slice: -80,
          },
        },
      }
    );
    return normalizeConversation(await collection.findOne(getOwnerFilter(sessionId, userId)));
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const convo = await getOrCreateConversation({ sessionId, userId });
    convo.activeTopic = activeTopic ?? null;
    convo.updatedAt = now;
    convo.lastGoodAssistantReply = assistantMessage.content;
    convo.messages = [...(convo.messages || []), userMessage, assistantMessage].slice(-80);
    memoryConversations.set(sessionId, convo);
    return normalizeConversation({ ...convo, messages: [...convo.messages] });
  }
};

export const appendAssistantOnly = async ({ sessionId, userId = null, assistantMessage }) => {
  const now = Date.now();
  try {
    const db = getDb();
    const collection = db.collection(COLLECTION);
    await collection.updateOne(
      getOwnerFilter(sessionId, userId),
      {
        $set: { updatedAt: now },
        $push: {
          messages: {
            $each: [assistantMessage],
            $slice: -80,
          },
        },
      }
    );
    return normalizeConversation(await collection.findOne(getOwnerFilter(sessionId, userId)));
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const convo = await getOrCreateConversation({ sessionId, userId });
    convo.updatedAt = now;
    convo.messages = [...(convo.messages || []), assistantMessage].slice(-80);
    memoryConversations.set(sessionId, convo);
    return normalizeConversation({ ...convo, messages: [...convo.messages] });
  }
};

export const clearConversationHistory = async ({ sessionId, userId = null, scope = "session" }) => {
  const now = Date.now();
  const baseReset = {
    activeTopic: null,
    messages: [createAssistantWelcome()],
    lastGoodAssistantReply: "",
    updatedAt: now,
  };

  try {
    const db = getDb();
    const collection = db.collection(COLLECTION);

    if (scope === "account" && userId) {
      await collection.updateMany({ userId }, { $set: baseReset });
      const current = await getOrCreateConversation({ sessionId, userId });
      return normalizeConversation(current);
    }

    await collection.updateOne(getOwnerFilter(sessionId, userId), { $set: baseReset }, { upsert: true });
    const current = await getOrCreateConversation({ sessionId, userId });
    return normalizeConversation(current);
  } catch (error) {
    if (!canFallbackToMemory()) throw error;

    if (scope === "account" && userId) {
      for (const [key, conversation] of memoryConversations.entries()) {
        if (conversation?.userId === userId) {
          memoryConversations.set(key, {
            ...conversation,
            ...baseReset,
            assistantProfile: normalizeAssistantProfile(conversation.assistantProfile),
          });
        }
      }
    } else {
      const conversation = await getOrCreateConversation({ sessionId, userId });
      memoryConversations.set(sessionId, {
        ...conversation,
        ...baseReset,
        assistantProfile: normalizeAssistantProfile(conversation.assistantProfile),
      });
    }

    const current = await getOrCreateConversation({ sessionId, userId });
    return normalizeConversation(current);
  }
};

export const listConversationSessions = async ({ sessionId, userId = null }) => {
  try {
    const db = getDb();
    const collection = db.collection(COLLECTION);
    const docs = userId
      ? await collection.find({ userId }).sort({ updatedAt: -1 }).limit(20).toArray()
      : await collection.find({ sessionId }).sort({ updatedAt: -1 }).limit(1).toArray();

    return docs.map((doc) => ({
      sessionId: doc.sessionId,
      updatedAt: doc.updatedAt || doc.createdAt || Date.now(),
      preview: String(doc.messages?.[doc.messages.length - 1]?.content || "New conversation").slice(0, 120),
      messageCount: Array.isArray(doc.messages) ? doc.messages.length : 0,
    }));
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const local = [...memoryConversations.values()]
      .filter((doc) => (userId ? doc.userId === userId : doc.sessionId === sessionId))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, userId ? 20 : 1)
      .map((doc) => ({
        sessionId: doc.sessionId,
        updatedAt: doc.updatedAt || doc.createdAt || Date.now(),
        preview: String(doc.messages?.[doc.messages.length - 1]?.content || "New conversation").slice(0, 120),
        messageCount: Array.isArray(doc.messages) ? doc.messages.length : 0,
      }));
    return local;
  }
};

export const deleteConversationSession = async ({ sessionId, userId = null, targetSessionId }) => {
  if (!targetSessionId) return false;

  try {
    const db = getDb();
    const collection = db.collection(COLLECTION);
    const filter = userId
      ? { sessionId: targetSessionId, userId }
      : { sessionId: targetSessionId === sessionId ? targetSessionId : "__blocked__" };

    const result = await collection.deleteOne(filter);
    return result.deletedCount > 0;
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const existing = memoryConversations.get(targetSessionId);
    if (!existing) return false;
    if (userId && existing.userId !== userId) return false;
    if (!userId && targetSessionId !== sessionId) return false;
    memoryConversations.delete(targetSessionId);
    return true;
  }
};
