import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbiParameters, type Hex } from "viem";
import { MISSIONEV_ABI } from "@/lib/contract/missionev.abi";
import { commuteVerifiedIn, hasContractCode, type Receipt } from "@/lib/contract/client";

const CONTRACT = "0x0904244017324dc1bf7c611fe1236936ee65fc82";
const USER = `0x${"ab".repeat(20)}` as Hex;
const TRIP = `0x${"cd".repeat(32)}` as Hex;

const commuteLog = (address: string, commuter: Hex = USER) => ({
  address,
  topics: encodeEventTopics({ abi: MISSIONEV_ABI, eventName: "CommuteVerified", args: { commuter, tripId: TRIP } }) as Hex[],
  data: encodeAbiParameters(parseAbiParameters("uint8 mode, uint32 distanceMeters, uint32 co2AvoidedGrams, uint256 pointsMinted, uint256 newCarbonScore"), [2, 1234, 20, BigInt(0), BigInt(20)]),
});
const receipt = (logs: Receipt["logs"], status: Receipt["status"] = "success"): Receipt => ({ status, blockNumber: 1, logs });

describe("is a mined transaction really a recorded commute?", () => {
  it("accepts a CommuteVerified event from the contract for this user", () => {
    expect(commuteVerifiedIn(receipt([commuteLog(CONTRACT)]), CONTRACT, USER)).toBe(true);
    expect(commuteVerifiedIn(receipt([commuteLog(CONTRACT.toUpperCase().replace("0X", "0x"))]), CONTRACT, USER.toUpperCase().replace("0X", "0x"))).toBe(true);
  });

  it("rejects a 'successful' receipt with no logs: a call to an address with no contract code also succeeds", () => {
    expect(commuteVerifiedIn(receipt([]), CONTRACT, USER)).toBe(false);
  });

  it("rejects the event when another address emitted it, or when it is for another wallet", () => {
    expect(commuteVerifiedIn(receipt([commuteLog(`0x${"11".repeat(20)}`)]), CONTRACT, USER)).toBe(false);
    expect(commuteVerifiedIn(receipt([commuteLog(CONTRACT, `0x${"ee".repeat(20)}`)]), CONTRACT, USER)).toBe(false);
  });

  it("ignores logs it can't decode", () => {
    expect(commuteVerifiedIn(receipt([{ address: CONTRACT, topics: [`0x${"00".repeat(32)}`], data: "0x" }]), CONTRACT, USER)).toBe(false);
  });
});

describe("is there a contract at the address the app is about to call?", () => {
  it("is false for empty code and true for deployed bytecode", async () => {
    expect(await hasContractCode(async () => "0x", CONTRACT)).toBe(false);
    expect(await hasContractCode(async () => "0x6080604052", CONTRACT)).toBe(true);
    expect(await hasContractCode(async () => null, CONTRACT)).toBe(false);
  });
});
