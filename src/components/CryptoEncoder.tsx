import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, ImageUp, QrCode, Terminal, Upload } from "lucide-react";
import QRCode from "qrcode";
import jsQR from "jsqr";

type CipherMode = "base64" | "hex" | "rot13" | "url" | "qr";

const CIPHER_LABELS: Record<CipherMode, string> = {
  base64: "BASE64",
  hex: "HEX",
  rot13: "ROT13",
  url: "URL ENCODE",
  qr: "QR CODE",
};

const encodeBase64 = (str: string) => {
  try {
    return btoa(str);
  } catch {
    return "[!] Encoding error: character out of ASCII range for Base64.";
  }
};

const decodeBase64 = (str: string) => {
  try {
    return atob(str);
  } catch {
    return "[!] Decoding error: invalid Base64 input.";
  }
};

const encodeHex = (str: string) => {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    result += str.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return result;
};

const decodeHex = (str: string) => {
  const clean = str.replace(/\s/g, "");
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) {
    return "[!] Decoding error: invalid hexadecimal input.";
  }
  let result = "";
  for (let i = 0; i < clean.length; i += 2) {
    result += String.fromCharCode(Number.parseInt(clean.substring(i, i + 2), 16));
  }
  return result;
};

const rot13 = (str: string) => {
  return str.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
  });
};

const encodeUrl = (str: string) => encodeURIComponent(str);
const decodeUrl = (str: string) => {
  try {
    return decodeURIComponent(str.replace(/\+/g, " "));
  } catch {
    return "[!] Decoding error: malformed URL encoding.";
  }
};

export default function CryptoEncoder() {
  const [mode, setMode] = useState<CipherMode>("base64");
  const [input, setInput] = useState("");
  const [encodeMode, setEncodeMode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [qrDecoded, setQrDecoded] = useState("");
  const [qrDecodeError, setQrDecodeError] = useState("");
  const [qrFileName, setQrFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate QR code canvas whenever input changes (in encode mode)
  useEffect(() => {
    if (mode !== "qr" || !encodeMode || !input.trim()) {
      setQrDataUrl("");
      setQrError("");
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(input.trim(), {
      width: 280,
      margin: 2,
      color: { dark: "#34d399", light: "#0a0f1e" },
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrError("[!] Error generating QR code. Input may be too long.");
          setQrDataUrl("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mode, encodeMode, input]);

  // Decode QR from uploaded image
  const decodeQrFromFile = useCallback((file: File) => {
    setQrFileName(file.name);
    setQrDecoded("");
    setQrDecodeError("");

    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        // Draw the image to a canvas to get pixel data
        const canvas = document.createElement("canvas");
        const maxDim = 1024;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setQrDecodeError("[!] Failed to read image data.");
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          setQrDecoded(code.data);
        } else {
          setQrDecodeError("[!] No QR code found in the image.");
        }
      };
      img.onerror = () => {
        setQrDecodeError("[!] Failed to load the image file.");
      };
      img.src = reader.result as string;
    };

    reader.onerror = () => {
      setQrDecodeError("[!] Failed to read the image file.");
    };

    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) decodeQrFromFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) decodeQrFromFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Standard text encoder output (for non-QR modes)
  const output = useMemo(() => {
    if (mode === "qr") return "";
    if (!input) return "";

    if (encodeMode) {
      switch (mode) {
        case "base64":
          return encodeBase64(input);
        case "hex":
          return encodeHex(input);
        case "rot13":
          return rot13(input);
        case "url":
          return encodeUrl(input);
      }
    } else {
      switch (mode) {
        case "base64":
          return decodeBase64(input);
        case "hex":
          return decodeHex(input);
        case "rot13":
          return rot13(input);
        case "url":
          return decodeUrl(input);
      }
    }
    return "";
  }, [input, mode, encodeMode]);

  const handleCopy = useCallback(async () => {
    if (!output || output.startsWith("[!]")) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  }, [output]);

  const isQrMode = mode === "qr";

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">CRYPTO CODEC</h2>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">// Real-time encode / decode utility</p>
          </div>
        </div>
      </div>

      {/* Cipher tab buttons */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(CIPHER_LABELS) as CipherMode[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold font-mono tracking-wider transition ${
              mode === key
                ? "bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/40"
                : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            {CIPHER_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Encode/Decode toggle — hidden for QR since both modes are visual */}
      {!isQrMode ? (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEncodeMode(true)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition ${
              encodeMode
                ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Encode
          </button>
          <button
            type="button"
            onClick={() => setEncodeMode(false)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition ${
              !encodeMode
                ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Decode
          </button>
          <span className="text-[10px] text-slate-600 ml-auto">
            {mode.toUpperCase()} {encodeMode ? "ENCODE" : "DECODE"}
          </span>
        </div>
      ) : null}

      {/* QR mode: show custom header */}
      {isQrMode ? (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEncodeMode(true)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition ${
              encodeMode
                ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Generate
          </button>
          <button
            type="button"
            onClick={() => setEncodeMode(false)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition ${
              !encodeMode
                ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Scan
          </button>
          <span className="text-[10px] text-slate-600 ml-auto">
            QR {encodeMode ? "GENERATE" : "DECODE"}
          </span>
        </div>
      ) : null}

      {/* QR GENERATE MODE */}
      {isQrMode && encodeMode ? (
        <>
          <div className="mb-3">
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Text to encode
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter text or URL to generate QR code..."
              className="min-h-[80px] w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-200 placeholder-slate-600 transition-all duration-200 focus:border-amber-500/40 focus:shadow-[0_0_10px_rgba(251,191,36,0.05)] focus:outline-none resize-y"
              spellCheck={false}
            />
          </div>

          {qrError ? (
            <div className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
              <p className="font-mono text-xs text-rose-300/90">{qrError}</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-emerald-500/20 bg-slate-950/80 p-4">
            <div className="mb-3 flex items-center gap-2">
              <QrCode className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400/80">
                out/qr.png
              </span>
            </div>
            {qrDataUrl ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={qrDataUrl}
                  alt="Generated QR code"
                  className="rounded-lg border border-emerald-500/20 bg-white p-2"
                  style={{ width: 200, height: 200 }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(input.trim());
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    } catch {
                      // clipboard unavailable
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/50 px-2.5 py-1 font-mono text-[10px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? "COPIED" : "COPY TEXT"}
                </button>
              </div>
            ) : (
              <p className="font-mono text-[10px] text-slate-600">
                {">"} Type text above to generate a QR code.
              </p>
            )}
          </div>
        </>
      ) : null}

      {/* QR DECODE MODE */}
      {isQrMode && !encodeMode ? (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-950/40 p-6 transition-colors hover:border-amber-500/40 hover:bg-slate-950/60"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="mb-2 h-8 w-8 text-slate-500" />
            <p className="text-xs font-mono text-slate-400 text-center">
              Drop a QR code image here or click to browse
            </p>
            {qrFileName ? (
              <p className="mt-2 text-[10px] font-mono text-slate-500">
                Selected: {qrFileName}
              </p>
            ) : null}
          </div>

          {qrDecodeError ? (
            <div className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
              <p className="font-mono text-xs text-rose-300/90">{qrDecodeError}</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-emerald-500/20 bg-slate-950/80 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ImageUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400/80">
                decode/result.txt
              </span>
            </div>
            {qrDecoded ? (
              <div className="space-y-2">
                <pre className="whitespace-pre-wrap break-all font-mono text-xs text-emerald-200/90 leading-relaxed">
                  {qrDecoded}
                </pre>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(qrDecoded);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    } catch {
                      // clipboard unavailable
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/50 px-2.5 py-1 font-mono text-[10px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? "COPIED" : "COPY TO CLIPBOARD"}
                </button>
              </div>
            ) : (
              <p className="font-mono text-[10px] text-slate-600">
                {">"} Upload a QR code image to decode its contents.
              </p>
            )}
          </div>
        </>
      ) : null}

      {/* Standard text cipher modes (non-QR) */}
      {!isQrMode ? (
        <>
          {/* Input */}
          <div className="mb-3">
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Input
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                encodeMode
                  ? "Enter text to encode..."
                  : "Enter ciphertext to decode..."
              }
              className="min-h-[80px] w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-200 placeholder-slate-600 transition-all duration-200 focus:border-amber-500/40 focus:shadow-[0_0_10px_rgba(251,191,36,0.05)] focus:outline-none resize-y"
              spellCheck={false}
            />
          </div>

          {/* Output */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Output
              </label>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!output || output.startsWith("[!]")}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/50 px-2.5 py-1 font-mono text-[10px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200 disabled:opacity-40"
              >
                <Copy className="h-3 w-3" />
                {copied ? "COPIED" : "COPY TO CLIPBOARD"}
              </button>
            </div>
            <div className="min-h-[80px] w-full rounded-lg border border-emerald-500/20 bg-slate-950/80 p-3">
              {output ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3 w-3 text-emerald-400" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-400/60">
                      out/{mode}.{encodeMode ? "enc" : "dec"}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-all font-mono text-xs text-emerald-200/90 leading-relaxed">
                    {output}
                  </pre>
                </div>
              ) : (
                <p className="font-mono text-[10px] text-slate-600">
                  {">"} Type or paste data above to see results.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
