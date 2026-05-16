# Integration: hosting this AI wallet inside slop-computer-live

This Next.js app runs in two modes:

1. **Standalone** — `https://wallet.slop.computer/` (or wherever it deploys). User connects via RainbowKit, signs with their own wallet, txs fire through wagmi.
2. **Embedded** — inside an iframe in `live.slop.computer`. The parent supplies wallet context via URL params. Execute actions are bridged to the parent's multisig pending queue via `postMessage`.

## Embedded URL contract

The parent (slop-computer-live) loads this app in an iframe with URL params:

```
https://wallet.slop.computer/?embedded=1&multisig=0x…&chain=8453&signer=0x…
```

| Param       | Required | Example                                      | Description                                                              |
| ----------- | -------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `embedded`  | yes      | `1`                                          | Enables embedded mode. Hides RainbowKit, compacts header, etc.            |
| `multisig`  | yes      | `0x8FB7…5c28`                                | The multisig address; treated as the operating wallet for portfolio + AI. |
| `chain`     | yes      | `8453`                                       | Chain id the multisig lives on. The AI prepares txs on this chain.        |
| `signer`    | no       | `0xabc…`                                     | The viewer's signer address. Shown in chips; not currently load-bearing.  |

If `embedded=1` is set but `multisig` is missing or malformed, the connect gate is shown — the app does not silently fall back to the EOA.

## postMessage contract — child → parent

When a user clicks **Send to multisig** on a transaction card (or a step in a multi-step card), the embedded app emits:

```js
window.parent.postMessage(
  {
    type: "slop:propose_tx",
    chainId: 8453,
    target: "0x…",       // address to call
    value: "1000000000000000", // wei as decimal string
    data: "0x…",          // hex calldata, "0x" for plain ETH transfer
    summary: "Swap 0.1 ETH for USDC on Base", // human-readable
  },
  "*",
);
```

`targetOrigin` is `"*"`. The child does not know the parent's origin at build time (could be live.slop.computer, a Vercel preview URL, or a localhost dev tunnel). Security is enforced on the parent side by validating `event.source` against the iframe element the parent itself created.

## Parent-side handler (live.slop.computer)

Inside slop-computer-live, the embedding component (e.g. `AIWalletWindow.tsx`) does:

```ts
useEffect(() => {
  const onMessage = (e: MessageEvent) => {
    if (e.source !== iframeRef.current?.contentWindow) return; // origin gate
    const msg = e.data;
    if (msg?.type !== "slop:propose_tx") return;
    // Compute nonce + execHash here, then:
    mesh.walletProposeTx({
      target: msg.target,
      value: msg.value,
      data: msg.data,
      deadline: defaultDeadline().toString(),
      nonce: nonce.toString(),
      execHash,
      source: "manual",
      browserId: null,
    });
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}, [iframeRef, mesh]);
```

The tx then appears in the multisig **Pending** section of the wallet app, where the configured signers approve and execute.

## What's NOT bridged (yet)

- Chain switching prompts (irrelevant — multisig already lives on its chain)
- `eth_sign` / typed-data signing (no use case yet inside the AI wallet)
- Read-only RPC calls (those go through the AI wallet's own `NEXT_PUBLIC_ALCHEMY_API_KEY`)

## Env vars (deploy-time)

| Key                            | Required | Purpose                                            |
| ------------------------------ | -------- | -------------------------------------------------- |
| `NEXT_PUBLIC_ALCHEMY_API_KEY`  | yes      | RPC reads (portfolio, ENS, simulation)             |
| `VENICE_API_KEY`               | yes      | Intent / chat (Claude Opus via Venice's OpenAI API) |
| `ZERION_API_KEY`               | yes      | Asset + activity feed                              |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | no | Standalone-mode WalletConnect support             |
