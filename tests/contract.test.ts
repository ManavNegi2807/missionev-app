import { beforeEach, describe, expect, it } from "vitest";
import { decodeEventLog, hashDomain, hexToBigInt, keccak256, toBytes, toHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { TRANSPORT_MODE } from "@/lib/carbon/contractMapping";
import { previewReward, scoreAfterTrip } from "@/lib/carbon/rewardPreview";
import { signTripPayload } from "@/lib/oracle/sign";
import { TRIP_TYPE_STRING, deriveTripId, eip712Domain, type TripPayload } from "@/lib/oracle/typedData";
import { PORTAL_V3 } from "@/lib/chain";
import { MISSIONEV_ABI, MISSIONEV_V2_ABI, artifact, createChain, proposed, type Chain } from "./helpers/evm";

/**
 * These tests execute the COMPILED contracts (contracts/artifacts, built from contracts/MissionEV.sol and the proposed
 * v2) in an in-process EVM whose chain id is Portal V3's. Nothing here touches a real network or a deployed contract.
 */

const DAY = 86400;
const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

type Version = "v1" | "v2";
const IMPLS = { v1: { abi: MISSIONEV_ABI, bytecode: artifact.bytecode as Hex }, v2: { abi: MISSIONEV_V2_ABI, bytecode: proposed.bytecode as Hex } };

const oracleKey = generatePrivateKey();
const oracle = privateKeyToAccount(oracleKey);
const deployer = privateKeyToAccount(generatePrivateKey()).address;
const newCommuter = () => privateKeyToAccount(generatePrivateKey());

interface Ctx { chain: Chain; contract: Hex; abi: typeof MISSIONEV_ABI }

async function setup(version: Version, oracleAddress: Hex = oracle.address): Promise<Ctx> {
  const chain = await createChain();
  const { abi, bytecode } = IMPLS[version];
  const contract = await chain.deploy({ from: deployer, abi, bytecode, ctorArgs: [oracleAddress] });
  return { chain, contract, abi };
}

const read = <T,>(c: Ctx, fn: string, args: unknown[] = []) => c.chain.read<T>({ to: c.contract, abi: c.abi, fn, args });
const tripIdOf = (label: string) => keccak256(toHex(label));

async function sign(c: Ctx, p: Omit<TripPayload, "nonce" | "deadline"> & { nonce?: bigint; deadline?: bigint }, key: Hex = oracleKey, contract: Hex = c.contract): Promise<{ payload: TripPayload; sig: Hex }> {
  const nonce = p.nonce ?? (await read<bigint>(c, "nonces", [p.commuter]));
  const payload: TripPayload = { ...p, nonce, deadline: p.deadline ?? BigInt(c.chain.now + 600) };
  return { payload, sig: await signTripPayload({ privateKey: key, chainId: c.chain.chainId, verifyingContract: contract, payload }) };
}

const submit = (c: Ctx, from: Hex, { payload, sig }: { payload: TripPayload; sig: Hex }) =>
  c.chain.send({ from, to: c.contract, abi: c.abi, fn: "recordCommute", args: [payload.tripId, payload.mode, payload.distanceMeters, payload.co2AvoidedGrams, payload.deadline, sig] });

const base = (commuter: Hex, label: string, over: Partial<TripPayload> = {}) => ({
  commuter, tripId: tripIdOf(label), mode: TRANSPORT_MODE.EV_CAR as number, distanceMeters: 10_000, co2AvoidedGrams: 189, ...over,
});

describe.each(["v1", "v2"] as const)("MissionEV %s — signing and recording", (version) => {
  let c: Ctx;
  beforeEach(async () => { c = await setup(version); });

  it("compiled TRIP_TYPEHASH and DOMAIN_SEPARATOR equal what the app signs against (Portal V3 chain id)", async () => {
    expect(c.chain.chainId).toBe(420420777);
    expect(PORTAL_V3.chainId).toBe(420420777);
    expect(await read<Hex>(c, "TRIP_TYPEHASH")).toBe(keccak256(toBytes(TRIP_TYPE_STRING)));
    expect(await read<Hex>(c, "DOMAIN_SEPARATOR")).toBe(hashDomain({ domain: eip712Domain(420420777, c.contract), types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }] } } as never));
    expect(await read<Hex>(c, "azureOracleSigner")).toBe(oracle.address);
  });

  it("accepts an oracle-signed trip from the commuter's wallet and mints exactly what the preview says", async () => {
    const u = newCommuter();
    const signed = await sign(c, base(u.address, "t1"));
    const res = await submit(c, u.address, signed);
    expect(res).toMatchObject({ ok: true });

    const pre = previewReward({ commuter: { streakDays: 0, lastTripTimestamp: 0 }, mode: TRANSPORT_MODE.EV_CAR, co2AvoidedGrams: 189, nowSec: c.chain.now });
    const [score, streak, last, avoided, trips, balance] = await read<readonly bigint[]>(c, "getCommuter", [u.address]);
    expect(balance).toBe(pre.rewardWei);
    expect(balance).toBe(BigInt("13780000000000000000")); // 189 g × 20/kg = 3.78 + 10 EV bonus
    expect(await read<bigint>(c, "balanceOf", [u.address])).toBe(balance);
    expect([Number(score), Number(streak), Number(last), Number(avoided), Number(trips)]).toEqual([scoreAfterTrip(0, 189), 1, c.chain.now, 189, 1]);
    expect(await read<bigint>(c, "totalSupply")).toBe(balance);
    expect(await read<boolean>(c, "processedTrips", [signed.payload.tripId])).toBe(true);
    expect(await read<bigint>(c, "nonces", [u.address])).toBe(BigInt(1));
  });

  it("the event's pointsMinted is a truncated whole-MEV number; exact amounts must come from balanceOf", async () => {
    const u = newCommuter();
    const res = await submit(c, u.address, await sign(c, base(u.address, "ev1")));
    if (!res.ok) throw new Error(res.reason);
    const logs = res.logs as Array<[Uint8Array, Uint8Array[], Uint8Array]>;
    const decoded = logs
      .map(([, topics, data]) => { try { return decodeEventLog({ abi: c.abi, data: toHex(data), topics: topics.map((t) => toHex(t)) as [Hex, ...Hex[]] }); } catch { return null; } })
      .find((e) => e?.eventName === "CommuteVerified");
    expect((decoded?.args as unknown as { pointsMinted: bigint }).pointsMinted).toBe(BigInt(13)); // 13.78 MEV minted, event says 13
  });

  it("rejects a stale signature after the nonce moves, and a replayed trip id", async () => {
    const u = newCommuter();
    const first = await sign(c, base(u.address, "a"));
    const stale = await sign(c, base(u.address, "b"), oracleKey, c.contract); // signed at nonce 0 too
    expect(await submit(c, u.address, first)).toMatchObject({ ok: true });
    expect(await submit(c, u.address, stale)).toMatchObject({ ok: false, reason: expect.stringContaining("Invalid oracle signature") });
    // a fresh signature on the new nonce works for a new trip…
    expect(await submit(c, u.address, await sign(c, base(u.address, "b")))).toMatchObject({ ok: true });
    // …but never for an already-processed trip id
    expect(await submit(c, u.address, await sign(c, base(u.address, "a")))).toMatchObject({ ok: false, reason: expect.stringContaining("Trip already processed") });
  });

  it("rejects an expired signature", async () => {
    const u = newCommuter();
    const signed = await sign(c, base(u.address, "late"), oracleKey, c.contract);
    c.chain.now = Number(signed.payload.deadline) + 1;
    expect(await submit(c, u.address, signed)).toMatchObject({ ok: false, reason: expect.stringContaining("Signature expired") });
  });

  it("binds the signature to the commuter, every field, the signer and the contract", async () => {
    const a = newCommuter();
    const b = newCommuter();
    const good = await sign(c, base(a.address, "x"));
    expect(await submit(c, b.address, good)).toMatchObject({ ok: false }); // someone else's signature
    for (const tweak of [{ co2AvoidedGrams: 190 }, { distanceMeters: 10_001 }, { mode: TRANSPORT_MODE.ACTIVE }]) {
      const forged = { ...good, payload: { ...good.payload, ...tweak } };
      expect(await submit(c, a.address, forged)).toMatchObject({ ok: false, reason: expect.stringContaining("Invalid oracle signature") });
    }
    const wrongSigner = await sign(c, base(a.address, "y"), generatePrivateKey());
    expect(await submit(c, a.address, wrongSigner)).toMatchObject({ ok: false });
    const otherContract = await sign(c, base(a.address, "z"), oracleKey, "0x00000000000000000000000000000000000000AA");
    expect(await submit(c, a.address, otherContract)).toMatchObject({ ok: false });
  });

  it("rejects a mode outside the enum", async () => {
    const u = newCommuter();
    const { sig } = await sign(c, base(u.address, "m"));
    const res = await c.chain.send({ from: u.address, to: c.contract, abi: c.abi, fn: "recordCommute", args: [tripIdOf("m"), 7, 10_000, 189, BigInt(c.chain.now + 600), sig] });
    expect(res.ok).toBe(false);
  });

  it("streak: +1 on consecutive days, reset after a gap, unchanged (but still minting) on the same day", async () => {
    const u = newCommuter();
    const go = async (label: string, grams = 1000) => {
      const r = await submit(c, u.address, await sign(c, base(u.address, label, { mode: TRANSPORT_MODE.EBUS, co2AvoidedGrams: grams })));
      expect(r).toMatchObject({ ok: true });
      const [, streak, , , , balance] = await read<readonly bigint[]>(c, "getCommuter", [u.address]);
      return { streak: Number(streak), balance };
    };
    expect((await go("d1")).streak).toBe(1);
    const sameDay = await go("d1b");
    expect(sameDay.streak).toBe(1);
    expect(sameDay.balance).toBe(BigInt(40) * BigInt("1000000000000000000")); // two trips × 20 MEV: no daily limit in the contract
    c.chain.now += DAY;
    expect((await go("d2")).streak).toBe(2);
    c.chain.now += 3 * DAY;
    expect((await go("d5")).streak).toBe(1);
  });

  it("preview equals the contract for every mode, several grams and streak steps", async () => {
    const u = newCommuter();
    let last = BigInt(0);
    let streakDays = 0;
    let lastTs = 0;
    let n = 0;
    for (const day of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21]) {
      if (day) c.chain.now += DAY;
      const mode = n % 7;
      const grams = [0, 1, 499, 500, 501, 2000, 2001, 123_456][n % 8];
      const pre = previewReward({ commuter: { streakDays, lastTripTimestamp: lastTs }, mode, co2AvoidedGrams: grams, nowSec: c.chain.now });
      const r = await submit(c, u.address, await sign(c, base(u.address, `p${n}`, { mode, co2AvoidedGrams: grams })));
      expect(r).toMatchObject({ ok: true });
      const bal = (await read<readonly bigint[]>(c, "getCommuter", [u.address]))[5];
      const minted = bal - last;
      // v2 intentionally pays no mode bonus for zero avoided grams
      const expected = version === "v2" && grams === 0 ? BigInt(0) : pre.rewardWei;
      expect(minted, `mode ${mode} grams ${grams} streak ${pre.streakDays}`).toBe(expected);
      last = bal;
      streakDays = pre.streakDays;
      lastTs = c.chain.now;
      n++;
    }
  });
});

describe("MissionEV v1 — audit findings, demonstrated against the compiled contract", () => {
  it("F1 (critical): a zero oracle address makes ANY garbage signature mint rewards", async () => {
    const c = await setup("v1", "0x0000000000000000000000000000000000000000");
    const u = newCommuter();
    const payload = { ...base(u.address, "evil", { co2AvoidedGrams: 4_000_000 }), nonce: BigInt(0), deadline: BigInt(c.chain.now + 600) };
    const garbage = `0x${"00".repeat(65)}` as Hex;
    expect(await submit(c, u.address, { payload, sig: garbage })).toMatchObject({ ok: true });
    expect((await read<readonly bigint[]>(c, "getCommuter", [u.address]))[5]).toBeGreaterThan(BigInt(80_000) * BigInt("1000000000000000000"));
  });

  it("F1 fix: v2 refuses to deploy with a zero oracle", async () => {
    await expect(setup("v2", "0x0000000000000000000000000000000000000000")).rejects.toThrow(/Invalid oracle address/);
  });

  it("F2/F3: a high-s 'twin' of a valid signature is also accepted by v1 (malleability) and rejected by v2", async () => {
    for (const version of ["v1", "v2"] as const) {
      const c = await setup(version);
      const u = newCommuter();
      const { payload, sig } = await sign(c, base(u.address, "twin"));
      const r = `0x${sig.slice(2, 66)}`;
      const s = hexToBigInt(`0x${sig.slice(66, 130)}`);
      const v = parseInt(sig.slice(130, 132), 16);
      const twin = `${r}${(N - s).toString(16).padStart(64, "0")}${(v === 27 ? 28 : 27).toString(16)}` as Hex;
      const res = await submit(c, u.address, { payload, sig: twin });
      if (version === "v1") expect(res).toMatchObject({ ok: true });
      else expect(res).toMatchObject({ ok: false, reason: expect.stringContaining("Invalid signature s") });
    }
  });

  it("F4: v1 does not check the signature length; v2 requires exactly 65 bytes", async () => {
    for (const version of ["v1", "v2"] as const) {
      const c = await setup(version);
      const u = newCommuter();
      const { payload, sig } = await sign(c, base(u.address, "len"));
      const padded = `${sig}00` as Hex; // 66 bytes: trailing byte ignored by v1
      const res = await submit(c, u.address, { payload, sig: padded });
      if (version === "v1") expect(res).toMatchObject({ ok: true });
      else expect(res).toMatchObject({ ok: false, reason: expect.stringContaining("Bad signature length") });
    }
  });

  it("F5: zero-gram trips still mint the mode bonus in v1 (10 MEV EV/metro, 15 MEV active); v2 pays nothing", async () => {
    const mev = BigInt("1000000000000000000");
    for (const [version, mode, want] of [["v1", TRANSPORT_MODE.EV_CAR, BigInt(10)], ["v1", TRANSPORT_MODE.ACTIVE, BigInt(15)], ["v1", TRANSPORT_MODE.ICE_CAR, BigInt(0)], ["v2", TRANSPORT_MODE.EV_CAR, BigInt(0)]] as const) {
      const c = await setup(version);
      const u = newCommuter();
      expect(await submit(c, u.address, await sign(c, base(u.address, "zero", { mode, co2AvoidedGrams: 0 })))).toMatchObject({ ok: true });
      expect(await read<bigint>(c, "balanceOf", [u.address])).toBe(want * mev);
    }
  });

  it("F6: v1 pays a base reward for an ICE trip with avoided grams (nothing in the contract restricts mode)", async () => {
    const c = await setup("v1");
    const u = newCommuter();
    expect(await submit(c, u.address, await sign(c, base(u.address, "ice", { mode: TRANSPORT_MODE.ICE_CAR, co2AvoidedGrams: 1000 })))).toMatchObject({ ok: true });
    expect(await read<bigint>(c, "balanceOf", [u.address])).toBe(BigInt(20) * BigInt("1000000000000000000"));
  });

  it("F7/F8: v1's token can be sent to address(0) and has no transferFrom; v2 fixes both", async () => {
    const hasFn = (abi: typeof MISSIONEV_ABI, name: string) => (abi as readonly { name?: string }[]).some((x) => x.name === name);
    expect(hasFn(MISSIONEV_ABI, "transferFrom")).toBe(false);
    expect(hasFn(MISSIONEV_V2_ABI, "transferFrom")).toBe(true);
    const zero = "0x0000000000000000000000000000000000000000";
    for (const version of ["v1", "v2"] as const) {
      const c = await setup(version);
      const u = newCommuter();
      await submit(c, u.address, await sign(c, base(u.address, "tok")));
      const burn = await c.chain.send({ from: u.address, to: c.contract, abi: c.abi, fn: "transfer", args: [zero, BigInt(1)] });
      if (version === "v1") expect(burn).toMatchObject({ ok: true });
      else expect(burn).toMatchObject({ ok: false, reason: expect.stringContaining("zero address") });
    }
    // v2 transferFrom honours allowances
    const c = await setup("v2");
    const u = newCommuter();
    const spender = newCommuter();
    await submit(c, u.address, await sign(c, base(u.address, "tf")));
    expect(await c.chain.send({ from: spender.address, to: c.contract, abi: c.abi, fn: "transferFrom", args: [u.address, spender.address, BigInt(5)] })).toMatchObject({ ok: false });
    await c.chain.send({ from: u.address, to: c.contract, abi: c.abi, fn: "approve", args: [spender.address, BigInt(5)] });
    expect(await c.chain.send({ from: spender.address, to: c.contract, abi: c.abi, fn: "transferFrom", args: [u.address, spender.address, BigInt(5)] })).toMatchObject({ ok: true });
    expect(await read<bigint>(c, "balanceOf", [spender.address])).toBe(BigInt(5));
  });

  it("deriveTripId is deterministic and 32 bytes", () => {
    const args = { commuter: oracle.address, clientTripId: "trip_abc", startedAt: 1, endedAt: 2, routeDigest: keccak256(toHex("r")) };
    expect(deriveTripId(args)).toBe(deriveTripId(args));
    expect(deriveTripId(args)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(deriveTripId({ ...args, clientTripId: "trip_abd" })).not.toBe(deriveTripId(args));
  });
});
