import { Router } from "express";
import { upload } from "../../src/middleware/upload.mjs";
import { recordSecurityEvent, recordUploadedFile } from "../../src/services/memoryService.mjs";

const router = Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ status: "error", code: "file_missing", message: "File is required." });
    return;
  }

  await recordUploadedFile({
    userId: req.user?.sub ?? null,
    sessionId: req.neurobotSessionId,
    file: {
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    },
  });
  await recordSecurityEvent({
    userId: req.user?.sub ?? null,
    sessionId: req.neurobotSessionId,
    action: "file_upload",
    detail: `Uploaded ${file.originalname}`,
    metadata: { mimeType: file.mimetype, size: file.size },
  });

  res.json({
    status: "ok",
    file: {
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    },
  });
});

export default router;
