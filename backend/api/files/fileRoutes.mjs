import { Router } from "express";
import sharp from "sharp";
import { upload } from "../../src/middleware/upload.mjs";
import { analyzeAttachment } from "../../src/services/fileAnalyzer.js";
import { recordSecurityEvent, recordUploadedFile } from "../../src/services/memoryService.mjs";

const router = Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ status: "error", code: "file_missing", message: "File is required." });
    return;
  }

  let processedBuffer = file.buffer;
  let compressed = null;
  if (String(file.mimetype || "").startsWith("image/")) {
    try {
      const transformed = await sharp(file.buffer)
        .rotate()
        .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      if (transformed.length < file.buffer.length) {
        processedBuffer = transformed;
        compressed = {
          originalBytes: file.buffer.length,
          compressedBytes: transformed.length,
          savedBytes: file.buffer.length - transformed.length,
        };
      }
    } catch {
      compressed = null;
    }
  }

  const analysis = await analyzeAttachment({
    filename: file.originalname,
    mimeType: file.mimetype,
    size: processedBuffer.length,
    base64: processedBuffer.toString("base64"),
  });

  await recordUploadedFile({
    userId: req.user?.sub ?? null,
    sessionId: req.neurobotSessionId,
    file: {
      filename: file.originalname,
      mimeType: file.mimetype,
      size: processedBuffer.length,
    },
  });
  await recordSecurityEvent({
    userId: req.user?.sub ?? null,
    sessionId: req.neurobotSessionId,
    action: "file_upload",
    detail: `Uploaded ${file.originalname}`,
      metadata: { mimeType: file.mimetype, size: processedBuffer.length },
    });

  res.json({
    status: "ok",
    file: {
      filename: file.originalname,
      mimeType: file.mimetype,
      size: processedBuffer.length,
    },
    compressed,
    analysis,
  });
});

router.post("/analyze", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ status: "error", code: "file_missing", message: "File is required." });
      return;
    }
    const analysis = await analyzeAttachment({
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      base64: file.buffer.toString("base64"),
    });
    res.json({ status: "ok", analysis });
  } catch (error) {
    next(error);
  }
});

export default router;
