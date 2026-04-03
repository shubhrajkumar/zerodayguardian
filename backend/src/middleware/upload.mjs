import multer from "multer";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FILE_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "text/x-python",
  "text/x-java-source",
  "text/x-c",
  "text/x-c++",
  "text/x-go",
  "text/x-rust",
  "text/x-shellscript",
  "text/x-php",
  "application/x-php",
  "text/x-ruby",
  "text/x-sql",
  "application/x-yaml",
  "text/yaml",
]);

const fileFilter = (_req, file, cb) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (ALLOWED_IMAGE_MIME.has(mime) || ALLOWED_FILE_MIME.has(mime)) {
    cb(null, true);
    return;
  }
  const err = new Error("Unsupported file type. Please upload a PDF, text file, or JPG/PNG/WEBP image.");
  err.status = 400;
  err.code = "unsupported_file_type";
  cb(err);
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter,
});
