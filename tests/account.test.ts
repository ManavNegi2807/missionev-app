import { describe, expect, it } from "vitest";
import { isAddress, userIdFor } from "@/lib/account";

const A = "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01";
const B = "0x184Ef822438f5D64C9dD41F570af794b347CE84e";

describe("account ids", () => {
  it("derives a short usr_ id from the address, the same for any letter case", async () => {
    const id = await userIdFor(A);
    expect(id).toMatch(/^usr_[0-9a-f]{8}$/);
    expect(await userIdFor(A.toLowerCase())).toBe(id);
    expect(await userIdFor(A.toUpperCase().replace("0X", "0x"))).toBe(id);
  });
  it("gives different wallets different ids, and never contains the address", async () => {
    const [a, b] = [await userIdFor(A), await userIdFor(B)];
    expect(a).not.toBe(b);
    expect(a.toLowerCase()).not.toContain(A.slice(2, 10).toLowerCase());
  });
});

describe("isAddress", () => {
  it("accepts a 20-byte hex address", () => {
    expect(isAddress(A)).toBe(true);
    expect(isAddress(B)).toBe(true);
  });
  it("rejects anything a misbehaving wallet might hand back", () => {
    for (const bad of [undefined, null, 42, "", "0x", "0x1234", `0x${"g".repeat(40)}`, `${A}00`, A.slice(2), [A]]) expect(isAddress(bad)).toBe(false);
  });
});
