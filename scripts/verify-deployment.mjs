// Read-only check of a deployed MissionEV contract: code present, owner, oracle, domain separator for this chain + address.
//   PORTAL_RPC_URL=https://… node scripts/verify-deployment.mjs --address 0x… [--artifact MissionEVv2.proposed] [--oracle 0x…] [--owner 0x…]
// It also reports how old the RPC's newest block is, because a node that isn't following the chain gives stale answers.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, getAddress, hashDomain, http } from "viem";

/**
 * The compiler leaves an `immutable` (here DOMAIN_SEPARATOR) as 32 zero bytes in the artifact; the chain fills in the real value when the
 * contract is created. So the deployed code differs from the artifact exactly there. Write the independently recomputed value into every
 * all-zero slot of the artifact where it appears on-chain, then require every other byte to be identical.
 */
function sameCode(chainCode, artifactCode, immutableValue) {
  const onChain = chainCode.slice(2).toLowerCase();
  const compiled = artifactCode.slice(2).toLowerCase();
  const value = immutableValue.slice(2).toLowerCase();
  if (onChain.length !== compiled.length) return false;
  let patched = compiled;
  for (let at = onChain.indexOf(value); at !== -1; at = onChain.indexOf(value, at + 2)) {
    if (at % 2 === 0 && /^0{64}$/.test(compiled.slice(at, at + 64))) patched = patched.slice(0, at) + value + patched.slice(at + 64);
  }
  return patched === onChain;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const rpc = process.env.PORTAL_RPC_URL;
const address = opt("address");
const artifactName = opt("artifact") ?? "MissionEVv2.proposed";
if (!/^https?:\/\//.test(rpc ?? "") || !/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) {
  console.error("usage: PORTAL_RPC_URL=https://… node scripts/verify-deployment.mjs --address 0x… [--artifact MissionEVv2.proposed] [--oracle 0x…] [--owner 0x…]");
  process.exitCode = 1;
} else {
  const artifact = JSON.parse(readFileSync(join(root, "contracts", "artifacts", `${artifactName}.json`), "utf8"));
  const c = createPublicClient({ transport: http(rpc, { timeout: 20_000 }) });
  const [chainId, head, code] = await Promise.all([c.getChainId(), c.getBlock(), c.getCode({ address })]);
  const age = Math.round(Date.now() / 1000 - Number(head.timestamp));
  console.log(`chain ${chainId} · newest block #${head.number} is ${Math.round(age / 60)} min old${age > 300 ? "  ← STALE: this node isn't following the chain; absent code below does NOT prove absence" : ""}`);
  const hasCode = Boolean(code && code !== "0x");
  console.log(`code at ${address}: ${hasCode ? `${(code.length - 2) / 2} bytes (artifact ${(artifact.deployedBytecode.length - 2) / 2})` : "none"}`);
  let ok = hasCode;
  if (hasCode) {
    const read = (functionName) => c.readContract({ address, abi: artifact.abi, functionName });
    // The contract's getter for the oracle signer is found in its ABI, so this script never has to spell the on-chain name.
    const signerGetter = artifact.abi.find((x) => x.type === "function" && /OracleSigner$/.test(x.name))?.name;
    const fields = await Promise.all([read(signerGetter), read("owner"), read("DOMAIN_SEPARATOR"), read("name")]).catch(() => null);
    if (!fields) {
      // Code exists but it doesn't answer MissionEV's own getters: it is some other contract.
      console.log("FAIL  not a MissionEV contract: the oracle signer, owner, DOMAIN_SEPARATOR and name could not be read");
      ok = false;
    } else {
      const [signer, owner, domain, name] = fields;
      const expected = hashDomain({ domain: { name: "MissionEV", version: "1", chainId, verifyingContract: getAddress(address) }, types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }] } });
      const rows = [
        ["runtime code equals the artifact (apart from the DOMAIN_SEPARATOR immutable)", sameCode(code, artifact.deployedBytecode, expected)],
        ["DOMAIN_SEPARATOR matches chain id + address", domain === expected],
        ["token name", name === "MissionEV Carbon Reward"],
        ...(opt("oracle") ? [["oracle signer == --oracle", signer.toLowerCase() === opt("oracle").toLowerCase()]] : []),
        ...(opt("owner") ? [["owner == --owner", owner.toLowerCase() === opt("owner").toLowerCase()]] : []),
      ];
      console.log(`oracle signer ${signer}\nowner         ${owner}`);
      for (const [n, pass] of rows) {
        console.log(`${pass ? "OK  " : "FAIL"}  ${n}`);
        ok &&= pass;
      }
    }
  }
  process.exitCode = ok ? 0 : 1;
}
