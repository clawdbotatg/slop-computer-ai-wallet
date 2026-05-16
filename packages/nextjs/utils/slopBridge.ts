// postMessage bridge between this AI wallet (when embedded inside an iframe
// in live.slop.computer) and the parent slop-computer-live window.
//
// CONTRACT
// --------
// Direction: child (this app) → parent (live.slop.computer)
// Method:    window.parent.postMessage(payload, "*")
//
// When the user clicks Execute on a TransactionCard or a step in a
// MultiStepTransactionCard while embedded, instead of firing the tx through
// the user's own wagmi wallet, we emit a `slop:propose_tx` event. The parent
// catches it, computes the multisig nonce + execHash, and calls
// `mesh.walletProposeTx({source: "manual"})` so the tx lands in the multisig
// Pending queue where signers approve and execute.
//
// Why "*" and not a tighter targetOrigin? At fork-build time we don't know
// the parent origin (could be live.slop.computer, a Vercel preview, or a
// dev localhost). The parent in slop-computer-live validates `event.source`
// against the iframe it created — that's the security boundary, not the
// child's targetOrigin.

export type SlopProposeTxPayload = {
  type: "slop:propose_tx";
  chainId: number;
  target: string;
  value: string; // wei, as a decimal string (no `0x` prefix required)
  data: string; // hex calldata, 0x-prefixed; "0x" for plain ETH transfers
  summary?: string; // human-readable description for the multisig pending card
};

export function postProposeTx(payload: Omit<SlopProposeTxPayload, "type">): boolean {
  if (typeof window === "undefined") return false;
  if (window.parent === window) {
    // Not embedded — nothing to post to.
    return false;
  }
  try {
    window.parent.postMessage({ ...payload, type: "slop:propose_tx" }, "*");
    return true;
  } catch (err) {
    console.warn("[slopBridge] postMessage failed:", err);
    return false;
  }
}
