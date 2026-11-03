import { describe, expect, it } from "vitest";
import { flagEv, parseReceipt } from "@/lib/ocr/receipt";
import { linesFromText } from "@/lib/ocr/scan";
import { rideFromExtraction } from "@/lib/transport/rideHail";

// All sample text here is synthetic: no real Ola, Uber or Rapido receipts were available. The OCR engine itself (Tesseract.js)
// runs in the browser and is exercised in the browser flow; these tests cover what is done with the text it returns.

describe("EV flagging on receipts", () => {
  it("flags an electric model from the catalogue and says why", () => {
    const x = parseReceipt(["Uber", "Trip distance: 8.2 km", "Ride: Tata Tigor EV"]);
    expect(x.ev).toEqual({ flagged: true, basis: "model-list", evidence: expect.stringContaining("Tigor") });
    expect(x.notes.join(" ")).toContain("EV flagged");
  });

  it("flags EV wording on the receipt even when the model is not in the catalogue", () => {
    const x = parseReceipt(["Rapido", "Electric scooter ride", "2.5 km"]);
    expect(x.ev).toMatchObject({ flagged: true, basis: "receipt-text" });
  });

  it("does not flag a petrol car, or words that merely contain the letters ev", () => {
    expect(parseReceipt(["Ola Cabs", "Vehicle: Maruti Dzire", "Trip distance 12.4 km"]).ev).toEqual({ flagged: false, basis: null, evidence: null });
    expect(flagEv("Revenue receipt, Level 2, Devi Road", null).flagged).toBe(false);
  });

  it("pre-fills electric from a flag but never confirms it: the commuter still has to", () => {
    const form = rideFromExtraction(parseReceipt(["Rapido", "Electric scooter ride", "2.5 km"]));
    expect(form.fuel).toBe("electric");
    expect(form).toMatchObject({ source: "ocr-reviewed", confirmed: false });
  });

  it("leaves the fuel alone when nothing points to an EV", () => {
    const form = rideFromExtraction(parseReceipt(["Ola", "Trip distance 6 km"]));
    expect(form.fuel).toBe("");
  });
});

describe("OCR text handling", () => {
  it("splits raw OCR output into trimmed, non-trivial lines", () => {
    expect(linesFromText("  Ola   Cabs \r\n\r\n x \nTrip distance:   12.4 km\n")).toEqual(["Ola Cabs", "Trip distance: 12.4 km"]);
  });

  it("caps the number of lines it will parse", () => {
    const many = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
    expect(linesFromText(many)).toHaveLength(200);
  });

  it("returns nothing for an image with no text", () => {
    expect(linesFromText("\n  \n")).toEqual([]);
  });
});
