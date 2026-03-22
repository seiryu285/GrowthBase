import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const ANCHOR_ABI = parseAbi([
  "function anchor(bytes32 receiptHash, bytes32 policyHash, bytes32 artifactHash) external"
]);

export async function anchorReceiptOnChain(opts: {
  receiptHash: `0x${string}`;
  policyHash: `0x${string}`;
  artifactHash: `0x${string}`;
  privateKey: `0x${string}`;
  contractAddress: `0x${string}`;
}): Promise<string | null> {
  try {
    const account = privateKeyToAccount(opts.privateKey);
    const client = createWalletClient({ account, chain: base, transport: http() });
    const hash = await client.writeContract({
      address: opts.contractAddress,
      abi: ANCHOR_ABI,
      functionName: "anchor",
      args: [opts.receiptHash, opts.policyHash, opts.artifactHash]
    });
    return hash;
  } catch {
    return null; // fire-and-forget; never block receipt write
  }
}
