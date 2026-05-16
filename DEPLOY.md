# Deploy: slop-computer-ai-wallet

## Where it lives

- **GitHub**: `clawdbotatg/slop-computer-ai-wallet` (forked from `clawdbotatg/clawd-talk-to-your-wallet`)
- **Production**: not yet deployed — needs a Vercel project (see below)
- **Embedded in**: live.slop.computer (Phase 5 wires this up)

## Why not bgipfs

bgipfs serves static IPFS content. This app has **dynamic Next.js API routes**:

```
/api/intent              — Venice / Claude Opus chat + tool loop
/api/portfolio           — Zerion proxy
/api/activity            — Zerion proxy
/api/prices              — Zerion prices
/api/security            — token security check
/api/modal/address       — address detail
/api/modal/asset         — asset detail
/api/modal/network       — network detail
/api/modal/transaction   — tx detail
```

Each holds server-side API keys (`ANTHROPIC_API_KEY`, `VENICE_API_KEY`, `ZERION_API_KEY`) that can't ship in a static bundle without leaking them. The Next.js `next build` output marks all 9 routes as `ƒ (Dynamic) server-rendered on demand` — only the `/` page is static.

Refactoring to IPFS-friendly would require splitting:
- Frontend → static IPFS
- API routes → a separate Node service hosted somewhere with secrets

That's a separate, larger project. **Vercel is the path of least resistance.**

## Vercel setup (user to do once)

1. Visit https://vercel.com/new and import `clawdbotatg/slop-computer-ai-wallet`.
2. Framework preset: **Next.js**. Root directory: `packages/nextjs`.
3. Add env vars (values are in `~/clawd/clawd-md/.env.clawd` and in the denar.ai Vercel project as `ANTHROPIC_API_KEY` / `NEXT_PUBLIC_ALCHEMY_API_KEY`):

   | Key                                     | Source                                            |
   | --------------------------------------- | ------------------------------------------------- |
   | `ANTHROPIC_API_KEY`                     | already on denar.ai Vercel — copy across          |
   | `NEXT_PUBLIC_ALCHEMY_API_KEY`           | already on denar.ai Vercel — copy across          |
   | `VENICE_API_KEY`                        | `~/clawd/clawd-md/.env.clawd:VENICE_API_KEY`      |
   | `ZERION_API_KEY`                        | same as the one in slop-computer-live's `.env.local` |
   | `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | optional, for standalone-mode WC support          |

4. Deploy.

5. Once it's live, point a domain at it (suggestion: `wallet.slop.computer`) and the iframe in slop-computer-live will load from there. Until then, the Vercel preview URL works fine.

## Local dev

```bash
cd packages/nextjs
yarn install            # if not already
yarn dev                # boots on :3000 by default; PORT=3001 yarn dev to avoid clashes
```

Standalone mode at `http://localhost:3001/`. Embedded mode at `http://localhost:3001/?embedded=1&multisig=0x…&chain=8453`.
