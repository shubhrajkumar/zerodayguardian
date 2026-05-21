// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as fileAnalyzer from "../../backend/src/services/fileAnalyzer.js";

const { analyzeAttachment, analyzeAttachments } = fileAnalyzer as {
  analyzeAttachment: (...args: unknown[]) => unknown;
  analyzeAttachments: (...args: unknown[]) => unknown;
};

const escapePdfText = (text: string) => text.replace(/([()\\])/g, "\\$1");

const buildSimplePdfBuffer = (text: string) => {
  const header = "%PDF-1.4\n";
  const stream = `BT /F1 24 Tf 72 120 Td (${escapePdfText(text)}) Tj ET`;
  const objects: string[] = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream\nendobj\n`
  );
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let offset = Buffer.byteLength(header, "latin1");
  const offsets: number[] = [0];
  let body = "";
  for (const obj of objects) {
    offsets.push(offset);
    body += obj;
    offset += Buffer.byteLength(obj, "latin1");
  }

  const xrefStart = Buffer.byteLength(header + body, "latin1");
  const xrefLines = offsets
    .map((value, index) => (index === 0 ? "0000000000 65535 f \n" : `${String(value).padStart(10, "0")} 00000 n \n`))
    .join("");
  const xref = `xref\n0 ${offsets.length}\n${xrefLines}`;
  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const pdf = header + body + xref + trailer;
  return Buffer.from(pdf, "latin1");
};

describe("fileAnalyzer", () => {
  it("analyzes text attachments", async () => {
    const content = "Hello world\nINFO Service started\napi_key=abc123";
    const buffer = Buffer.from(content, "utf8");
    const result = (await analyzeAttachment({
      filename: "notes.txt",
      mimeType: "text/plain",
      size: buffer.length,
      base64: buffer.toString("base64"),
    })) as any;

    expect(result.kind).toBe("text");
    expect(result.extractedText).toContain("Hello world");
    expect(result.extractedStats.isLog).toBe(true);
    expect(result.sensitiveIndicators.length).toBeGreaterThan(0);
    expect(result.summary).toContain("Text-based file");
  });

  it("extracts PDF text and metadata when available", async () => {
    const pdfBuffer = buildSimplePdfBuffer("Hello PDF");
    const result = (await analyzeAttachment({
      filename: "sample.pdf",
      mimeType: "application/pdf",
      size: pdfBuffer.length,
      base64: pdfBuffer.toString("base64"),
    })) as any;

    expect(result.kind).toBe("pdf");
    expect(result.extractedText).toContain("Hello PDF");
    expect(result.pdfMeta.pages).toBeGreaterThan(0);
    expect(result.summary).toContain("PDF document");
  });

  it("builds attachment context for multiple files", async () => {
    const buffer = Buffer.from("Log entry", "utf8");
    const analysis = (await analyzeAttachments([
      {
        filename: "log.txt",
        mimeType: "text/plain",
        size: buffer.length,
        base64: buffer.toString("base64"),
      },
    ])) as any;

    expect(analysis.items.length).toBe(1);
    expect(analysis.promptContext).toContain("File: log.txt");
  });
});
