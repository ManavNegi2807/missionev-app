// Deploys a compiled MissionEV contract. DRY RUN BY DEFAULT: without --confirm it only checks the network and prints what it would do.
//
//   DEPLOYER_PRIVATE_KEY=0x…  PORTAL_RPC_URL=https://…  ORACLE_ADDRESS=0x…  node scripts/deploy-contract.mjs --artifact MissionEVv2.proposed
//   …same, plus --confirm to broadcast.
//
// --artifact is the file name (without .json) in contracts/artifacts: "MissionEV" (v1 as supplied) or "MissionEVv2.proposed".
// Run it yourself so the deployer key never leaves your machine. The deployer becomes the contract `owner`; ORACLE_ADDRESS is the PUBLIC
// address of the oracle signing key (the key itself goes only in the server's ORACLE_PRIVATE_KEY, never here).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, defineChain, encodeDeployData, formatEther, getAddress, hashDomain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTAL_CHAIN_ID = 420420777;
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
// die()/done() throw so execution stops at once; the single handler at the bottom sets the exit code (calling process.exit()
// while HTTP sockets are still closing trips a libuv assertion on Windows).
class Stop extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}
const die = (m) => {
  throw new Stop(`\nABORTED: ${m}`, 1);
};
try {

const artifactName = opt("artifact");
if (!artifactName) die("pass --artifact MissionEV (v1, as supplied) or --artifact MissionEVv2.proposed (the fixed proposal).");
const file = join(root, "contracts", "artifacts", `${artifactName}.json`);
if (!existsSync(file)) die(`no compiled artifact at ${file}. Run: npm run contract:compile`);
const artifact = JSON.parse(readFileSync(file, "utf8"));

const key = process.env.DEPLOYER_PRIVATE_KEY;
const rpc = process.env.PORTAL_RPC_URL;
const oracle = process.env.ORACLE_ADDRESS;
if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? "")) die("DEPLOYER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key (the wallet that pays tPOT gas and becomes the contract owner).");
if (!/^https?:\/\//.test(rpc ?? "")) die("PORTAL_RPC_URL must be an http(s) JSON-RPC URL for Portal V3.");
if (!/^0x[0-9a-fA-F]{40}$/.test(oracle ?? "") || /^0x0{40}$/.test(oracle)) die("ORACLE_ADDRESS must be the non-zero PUBLIC address of the oracle signing key. (A zero oracle makes the v1 contract accept any signature.)");

const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ transport: http(rpc, { timeout: 20_000 }) });
const chainId = await publicClient.getChainId().catch((e) => die(`couldn't reach the RPC: ${e.shortMessage ?? e.message}`));
if (chainId !== PORTAL_CHAIN_ID) die(`the RPC reports chain id ${chainId}, but Portal V3 is ${PORTAL_CHAIN_ID}. Refusing to deploy to the wrong network.`);
const chain = defineChain({ id: chainId, name: "Portal V3 Testnet", nativeCurrency: { name: "tPOT", symbol: "tPOT", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });

const balance = await publicClient.getBalance({ address: account.address });
const gasPrice = await publicClient.getGasPrice().catch(() => 0n);
const gas = await publicClient.estimateGas({ account, data: encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args: [getAddress(oracle)] }) }).catch(() => null);

console.log(`
Contract : ${artifact.contractName}  (${artifact.source}, ${artifact.compiler.name} ${artifact.compiler.version}, evm ${artifact.compiler.settings.evmVersion})
Network  : chain id ${chainId} (Portal V3)   RPC: ${new URL(rpc).origin}
Deployer : ${account.address}   balance ${formatEther(balance)} tPOT   (becomes the contract owner)
Oracle   : ${getAddress(oracle)}   (the contract's azureOracleSigner)
Gas      : ${gas ? `${gas} units` : "estimate unavailable (the RPC refused it; the account may be unfunded)"}${gas && gasPrice ? ` ≈ ${formatEther(gas * gasPrice)} tPOT` : ""}
`);
if (balance === 0n) console.log("WARNING: the deployer has 0 tPOT, so the transaction will fail.\n");

if (!flag("confirm")) {
  console.log("DRY RUN — nothing was sent. Re-run with --confirm to deploy. Deployment is irreversible and costs gas.");
  throw new Stop("", 0);
}

const wallet = createWalletClient({ account, chain, transport: http(rpc, { timeout: 30_000 }) });
console.log("Broadcasting…");
const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args: [getAddress(oracle)] }).catch((e) => die(`deployment was rejected: ${e.shortMessage ?? e.message}`));
console.log(`tx ${hash}\nWaiting for the receipt…`);
const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 }).catch((e) => die(`no receipt yet (${e.shortMessage ?? e.message}). The transaction may still confirm: check ${hash} on the explorer before re-running.`));
if (receipt.status !== "success" || !receipt.contractAddress) die(`the deployment transaction reverted (${hash}).`);
const address = receipt.contractAddress;

// Read it back: never report success on the strength of a receipt alone.
const read = (functionName) => publicClient.readContract({ address, abi: artifact.abi, functionName });
const [code, signer, owner, domain] = await Promise.all([publicClient.getCode({ address }), read("azureOracleSigner"), read("owner"), read("DOMAIN_SEPARATOR")]);
const expectedDomain = hashDomain({ domain: { name: "MissionEV", version: "1", chainId, verifyingContract: address }, types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }] } });
const checks = [
  ["contract code present", Boolean(code && code !== "0x")],
  ["azureOracleSigner == ORACLE_ADDRESS", signer.toLowerCase() === oracle.toLowerCase()],
  ["owner == deployer", owner.toLowerCase() === account.address.toLowerCase()],
  ["DOMAIN_SEPARATOR matches chain id + address", domain === expectedDomain],
];
for (const [n, ok] of checks) console.log(`${ok ? "OK  " : "FAIL"}  ${n}`);
if (checks.some(([, ok]) => !ok)) die("read-back checks failed. Do not use this address.");

const dir = join(root, "contracts", "deployments");
mkdirSync(dir, { recursive: true });
const record = { contract: artifact.contractName, artifact: artifactName, chainId, address, txHash: hash, blockNumber: Number(receipt.blockNumber), deployer: account.address, oracle: getAddress(oracle), compiler: artifact.compiler.version, deployedAt: new Date().toISOString() };
writeFileSync(join(dir, `${chainId}-${artifact.contractName}.json`), `${JSON.stringify(record, null, 2)}\n`);
console.log(`\nDeployed ${artifact.contractName} at ${address} (block ${record.blockNumber}). Record: contracts/deployments/${chainId}-${artifact.contractName}.json
\nNext, on the server (never commit these):\nMISSIONEV_CONTRACT_ADDRESS=${address}\nNEXT_PUBLIC_MEV_CONTRACT_ADDRESS=${address}\nPORTAL_RPC_URL=${rpc}\nORACLE_PRIVATE_KEY=<the key whose address is ${getAddress(oracle)}>`);
} catch (e) {
  if (e instanceof Stop) {
    if (e.message) console.error(e.message);
    process.exitCode = e.code;
  } else {
    console.error(e);
    process.exitCode = 1;
  }
}
