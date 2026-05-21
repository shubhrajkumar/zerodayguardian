import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { getDb } from "../config/db.mjs";

const COLLECTION = "osint_cases";

const toObjectId = (value) => (ObjectId.isValid(value) ? new ObjectId(value) : value);

const sanitizeText = (value = "") => String(value || "").trim().slice(0, 4000);

export const createCase = async ({
  ownerId,
  title,
  target,
  summary,
  notes,
  folder,
  tags = [],
  entities = [],
  modules = [],
  results = {},
}) => {
  const db = getDb();
  const now = Date.now();
  const doc = {
    ownerId: String(ownerId),
    title: sanitizeText(title || "Untitled Case"),
    target: sanitizeText(target || ""),
    summary: sanitizeText(summary || ""),
    notes: sanitizeText(notes || ""),
    folder: sanitizeText(folder || ""),
    tags: tags.map((tag) => sanitizeText(tag)).filter(Boolean).slice(0, 20),
    entities: entities.map((e) => sanitizeText(e)).filter(Boolean).slice(0, 200),
    modules: modules.map((m) => String(m || "")).filter(Boolean),
    results,
    createdAt: now,
    updatedAt: now,
    events: [
      {
        at: now,
        type: "case_created",
        detail: "Case created",
      },
    ],
    shareId: null,
  };
  const result = await db.collection(COLLECTION).insertOne(doc);
  return { ...doc, _id: result.insertedId };
};

export const listCases = async ({ ownerId, limit = 50 } = {}) => {
  const db = getDb();
  return db
    .collection(COLLECTION)
    .find({ ownerId: String(ownerId) })
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .toArray();
};

export const getCaseById = async ({ ownerId, id }) => {
  const db = getDb();
  const row = await db.collection(COLLECTION).findOne({ _id: toObjectId(id), ownerId: String(ownerId) });
  return row;
};

export const updateCase = async ({ ownerId, id, patch = {} }) => {
  const db = getDb();
  const now = Date.now();
  const update = {
    ...(patch.title != null ? { title: sanitizeText(patch.title) } : {}),
    ...(patch.summary != null ? { summary: sanitizeText(patch.summary) } : {}),
    ...(patch.notes != null ? { notes: sanitizeText(patch.notes) } : {}),
    ...(patch.folder != null ? { folder: sanitizeText(patch.folder) } : {}),
    ...(patch.tags ? { tags: patch.tags.map((tag) => sanitizeText(tag)).filter(Boolean).slice(0, 20) } : {}),
    ...(patch.entities ? { entities: patch.entities.map((e) => sanitizeText(e)).filter(Boolean).slice(0, 200) } : {}),
  };
  await db.collection(COLLECTION).updateOne(
    { _id: toObjectId(id), ownerId: String(ownerId) },
    {
      $set: { ...update, updatedAt: now },
      $push: { events: { at: now, type: "case_updated", detail: "Case updated" } },
    }
  );
  return getCaseById({ ownerId, id });
};

export const appendCaseEvent = async ({ ownerId, id, type, detail }) => {
  const db = getDb();
  const now = Date.now();
  await db.collection(COLLECTION).updateOne(
    { _id: toObjectId(id), ownerId: String(ownerId) },
    {
      $set: { updatedAt: now },
      $push: { events: { at: now, type: String(type || "event"), detail: sanitizeText(detail || "") } },
    }
  );
  return getCaseById({ ownerId, id });
};

export const addEntity = async ({ ownerId, id, entity }) => {
  const db = getDb();
  const now = Date.now();
  await db.collection(COLLECTION).updateOne(
    { _id: toObjectId(id), ownerId: String(ownerId) },
    {
      $set: { updatedAt: now },
      $addToSet: { entities: sanitizeText(entity) },
      $push: { events: { at: now, type: "entity_added", detail: sanitizeText(entity) } },
    }
  );
  return getCaseById({ ownerId, id });
};

export const createShare = async ({ ownerId, id }) => {
  const db = getDb();
  const shareId = randomUUID();
  const now = Date.now();
  await db.collection(COLLECTION).updateOne(
    { _id: toObjectId(id), ownerId: String(ownerId) },
    {
      $set: { shareId, updatedAt: now },
      $push: { events: { at: now, type: "share_created", detail: "Share link generated" } },
    }
  );
  return shareId;
};

export const getSharedCase = async ({ shareId }) => {
  const db = getDb();
  return db.collection(COLLECTION).findOne({ shareId });
};
