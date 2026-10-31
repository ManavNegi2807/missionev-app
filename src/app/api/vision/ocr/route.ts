import { parseReceipt } from "@/lib/ocr/receipt";
import { createLimiter, json } from "@/server/http";
import { getRuntime } from "@/server/runtime";

const allow = createLimiter(10, 60_000);
const MAX_BYTES = 4 * 1024 * 1024;

/** The image types Azure's Read OCR accepts, checked by magic bytes rather than by the (spoofable) Content-Type. */
function sniff(b: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

/**
 * POST /api/vision/ocr — multipart/form-data with an `image` field. Reads the receipt with Azure AI Vision (Image Analysis
 * 4.0, Read) and returns REVIEWABLE fields. Keys stay on the server. The image is held in memory for the one request and is
 * never stored or logged. When Azure isn't configured this answers 501, and the UI falls back to manual entry.
 */
export async function POST(request: Request) {
  const { config } = getRuntime();
  if (!config.vision) return json({ status: "not-configured", reason: "Receipt reading (Azure AI Vision) isn't configured on this server. Enter the ride details by hand." }, 501);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(ip)) return json({ status: "rate-limited", reason: "Too many uploads. Try again in a minute." }, 429);

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("image");
  } catch {
    return json({ status: "invalid", reason: "Send the receipt as multipart form data with an `image` field." }, 400);
  }
  if (!(file instanceof File)) return json({ status: "invalid", reason: "No image was attached." }, 400);
  if (file.size === 0 || file.size > MAX_BYTES) return json({ status: "invalid", reason: "The image must be between 1 byte and 4 MB." }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniff(bytes)) return json({ status: "invalid", reason: "Only JPEG, PNG or WebP screenshots are supported." }, 415);

  try {
    const res = await fetch(`${config.vision.endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": config.vision.key, "Content-Type": "application/octet-stream" },
      body: bytes,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return json({ status: "upstream-error", reason: `Azure AI Vision returned ${res.status}. Enter the ride details by hand.` }, 502);
    const data = (await res.json()) as { readResult?: { blocks?: Array<{ lines?: Array<{ text?: string }> }> } };
    const lines = (data.readResult?.blocks ?? []).flatMap((b) => (b.lines ?? []).map((l) => l.text ?? "")).filter(Boolean).slice(0, 200);
    if (lines.length === 0) return json({ status: "no-text", reason: "No text was found in the image. Try a sharper, full-screen screenshot or enter the details by hand." }, 422);
    return json({ status: "ok", provider: "azure-ai-vision", lineCount: lines.length, extraction: parseReceipt(lines) });
  } catch {
    return json({ status: "upstream-error", reason: "Azure AI Vision couldn't be reached. Enter the ride details by hand." }, 502);
  }
}
