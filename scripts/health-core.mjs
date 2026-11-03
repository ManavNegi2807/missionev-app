/**
 * The rules that decide whether Portal V3's two endpoints agree with each other. No network access here, so they are unit-tested
 * (tests/health.test.ts); scripts/network-health.mjs does the fetching.
 *
 * Why it exists: the public EVM endpoint is a proxy in front of the native node. On 31 October and 1 November it stopped following the
 * chain (its newest block stayed at #265334 for about two days) while the native node carried on, and it kept answering with stale
 * balances and nonces. Comparing the two endpoints catches that at once.
 */
export const PORTAL_V3_CHAIN_ID = 420420777;

export const LIMITS = {
  /** An EVM head older than this means the node is not following the chain. */
  maxHeadAgeSec: 120,
  /** How many blocks the EVM endpoint may trail the native node. */
  maxEvmLagBlocks: 10,
  /** How many blocks finality may trail the newest block before it is worth a warning. */
  maxFinalityLagBlocks: 20,
};

/**
 * @param {{ evm: { chainId: number, head: number, headTimestamp: number } | null,
 *           native: { chain: string, head: number, finalized: number, peers: number, isSyncing: boolean, shouldHavePeers: boolean } | null,
 *           now?: number, limits?: typeof LIMITS }} input  `now` and `headTimestamp` are Unix seconds.
 * @returns {{ verdict: "healthy" | "degraded" | "unhealthy", findings: Array<{ level: "ok" | "warn" | "fail", text: string }> }}
 */
export function assess({ evm, native, now = Date.now() / 1000, limits = LIMITS }) {
  const findings = [];
  const add = (level, text) => findings.push({ level, text });

  if (!evm) {
    add("fail", "The EVM endpoint did not answer.");
  } else {
    if (evm.chainId !== PORTAL_V3_CHAIN_ID) add("fail", `The EVM endpoint reports chain id ${evm.chainId}, not ${PORTAL_V3_CHAIN_ID}.`);
    else add("ok", `EVM chain id ${evm.chainId}.`);
    const age = Math.round(now - evm.headTimestamp);
    if (age > limits.maxHeadAgeSec) add("fail", `The EVM head (#${evm.head}) is ${formatAge(age)} old: the node is not following the chain, so balances and nonces it reports are stale.`);
    else add("ok", `EVM head #${evm.head} is ${formatAge(Math.max(0, age))} old.`);
  }

  if (!native) {
    add("warn", "The native node did not answer, so the EVM endpoint could not be cross-checked.");
  } else {
    add("ok", `Native node "${native.chain}" is at block #${native.head}, finalized #${native.finalized}.`);
    if (native.isSyncing) add("warn", "The native node reports that it is still syncing.");
    if (native.shouldHavePeers && native.peers === 0) add("warn", "The native node has no peers.");
    const finalityLag = native.head - native.finalized;
    if (finalityLag > limits.maxFinalityLagBlocks) add("warn", `Finality is ${finalityLag} blocks behind the newest block.`);
  }

  if (evm && native) {
    const lag = native.head - evm.head;
    if (lag > limits.maxEvmLagBlocks) add("fail", `The EVM endpoint is ${lag} blocks behind the native node (#${evm.head} against #${native.head}).`);
    else add("ok", `The EVM endpoint is within ${Math.max(0, lag)} block${Math.max(0, lag) === 1 ? "" : "s"} of the native node.`);
  }

  const verdict = findings.some((f) => f.level === "fail") ? "unhealthy" : findings.some((f) => f.level === "warn") ? "degraded" : "healthy";
  return { verdict, findings };
}

/** Seconds as a short human string: 45 s, 12 min, 3.5 h. */
export function formatAge(sec) {
  if (sec < 90) return `${sec} s`;
  if (sec < 5400) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}
