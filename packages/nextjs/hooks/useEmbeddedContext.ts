"use client";

import { useEffect, useState } from "react";

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

const EMPTY: EmbeddedContext = {
  embedded: false,
  multisigAddress: null,
  chainId: null,
  signerAddress: null,
};

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function pickAddress(raw: string | null | undefined): `0x${string}` | null {
  if (!raw || !ADDR_RE.test(raw)) return null;
  return raw.toLowerCase() as `0x${string}`;
}

// We read directly from window.location.search rather than next/navigation's
// useSearchParams() so the page doesn't need a Suspense wrapper during
// static prerendering. The hook returns the empty context on the SSR pass
// and resolves to the real params after mount — which is fine because
// /api/* calls and Execute are user-triggered, all post-mount.
export function useEmbeddedContext(): EmbeddedContext {
  const [ctx, setCtx] = useState<EmbeddedContext>(EMPTY);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const embedded = params.get("embedded") === "1";
    const multisigAddress = pickAddress(params.get("multisig"));
    const signerAddress = pickAddress(params.get("signer"));
    const chainRaw = params.get("chain");
    const chainId = chainRaw && /^\d+$/.test(chainRaw) ? parseInt(chainRaw, 10) : null;
    setCtx({ embedded, multisigAddress, chainId, signerAddress });
  }, []);
  return ctx;
}
