/**
 * Shared constants for the flag-gated "Testnet Demo Trip" path. Nothing here is secret, so the browser may import it.
 * The SERVER flag (`DEMO_SIGNING`) is the authority; `NEXT_PUBLIC_DEMO_SIGNING` only decides whether the UI offers the path.
 */

/** A demo trip must cover at least this much distance, recomputed by the oracle from the submitted samples. */
export const DEMO_MIN_DISTANCE_M = 1000;

/** The in-app demo run stops itself at this distance: a little over the minimum, so sub-3 m jitter filtering can't dip below it. */
export const DEMO_RUN_KM = 1.2;

/** Prefix hashed into a demo trip's id, so demo trips are distinguishable off-chain (the contract only sees an opaque bytes32). */
export const DEMO_TRIP_ID_PREFIX = "missionev-demo:";

export const DEMO_BANNER = "TESTNET DEMO TRIP: synthetic distance, not GPS-verified. The transaction is real; the trip is not.";
export const DEMO_BADGE = "DEMO · ON-CHAIN";

/** Public (UI-only) flag. Never trusted by the server. */
export const demoSigningUi = (): boolean => /^(1|true)$/i.test(process.env.NEXT_PUBLIC_DEMO_SIGNING ?? "");
