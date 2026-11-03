/**
 * The one place that spells the contract's signer getter. The deployed MissionEV contract exposes the oracle signer's
 * address under this name; it is part of the contract's ABI and of the bytecode already live on Portal V3, so it cannot
 * be renamed without redeploying. Everywhere else the app, the docs and the UI call it the "oracle signer".
 */
export const ORACLE_SIGNER_GETTER = "azureOracleSigner" as const;
