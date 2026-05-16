"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

// When this AI wallet is hosted inside live.slop.computer (via iframe),
// the parent window passes context through URL params:
//   ?embedded=1&multisig=0x…&chain=8453&signer=0x…
// In that mode the UI hides the EOA connect button, treats the multisig
// as the "operating wallet" for portfolio/activity queries, and pipes
// the Execute button through postMessage instead of wagmi.
export type EmbeddedContext = {
  embedded: boolean;
  multisigAddress: `0x${string}` | null;
  chainId: number | null;
  signerAddress: `0x${string}` | null;
};

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function pickAddress(raw: string | null | undefined): `0x${string}` | null {
  if (!raw || !ADDR_RE.test(raw)) return null;
  return raw.toLowerCase() as `0x${string}`;
}

export function useEmbeddedContext(): EmbeddedContext {
  const params = useSearchParams();
  return useMemo(() => {
    const embedded = params?.get("embedded") === "1";
    const multisigAddress = pickAddress(params?.get("multisig"));
    const signerAddress = pickAddress(params?.get("signer"));
    const chainRaw = params?.get("chain") ?? null;
    const chainId = chainRaw && /^\d+$/.test(chainRaw) ? parseInt(chainRaw, 10) : null;
    return { embedded, multisigAddress, chainId, signerAddress };
  }, [params]);
}
