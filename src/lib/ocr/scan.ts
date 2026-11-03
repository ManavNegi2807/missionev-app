import { parseReceipt, type ReceiptExtraction } from "./receipt";

/**
 * Reads a ride-receipt screenshot with Tesseract.js (open-source OCR, Apache-2.0) entirely in the browser: the image is
 * never uploaded to this app's server. The first scan downloads the OCR engine (a WebAssembly core plus the English
 * language data) from a public CDN, so it needs a connection once; nothing about the receipt is sent there.
 *
 * OCR is text extraction, not proof. The text goes through `parseReceipt`, which suggests reviewable fields and flags
 * electric vehicles; the commuter still confirms everything.
 */
export interface ScanProgress {
  /** Tesseract's own stage name, e.g. "recognizing text". */
  status: string;
  /** 0 to 1 within the current stage. */
  progress: number;
}

export interface ScanResult {
  text: string;
  lines: string[];
  /** Tesseract's mean word confidence, 0 to 100. */
  confidence: number;
  extraction: ReceiptExtraction;
}

/** Splits raw OCR text into trimmed, non-trivial lines. Pure, so it is unit-tested without running the engine. */
export function linesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1)
    .slice(0, 200);
}

export async function scanReceipt(image: Blob, onProgress?: (p: ScanProgress) => void): Promise<ScanResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => onProgress?.({ status: m.status, progress: m.progress }),
  });
  try {
    const { data } = await worker.recognize(image);
    const lines = linesFromText(data.text ?? "");
    return { text: data.text ?? "", lines, confidence: data.confidence ?? 0, extraction: parseReceipt(lines) };
  } finally {
    await worker.terminate();
  }
}
