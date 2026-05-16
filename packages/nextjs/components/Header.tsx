"use client";

import React from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useEmbeddedContext } from "~~/hooks/useEmbeddedContext";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const Header = () => {
  const { isConnected } = useAccount();
  const embedded = useEmbeddedContext();
  const visible = embedded.embedded ? !!embedded.multisigAddress : isConnected;

  return (
    <div
      className="sticky lg:static top-0 min-h-0 shrink-0 z-20 px-4 sm:px-6 flex items-center justify-between"
      style={{
        backgroundColor: visible ? "var(--slop-bg, #06030d)" : "transparent",
        borderBottom: visible ? "1px solid rgba(255, 62, 201, 0.18)" : "none",
        height: embedded.embedded ? "44px" : "72px",
      }}
    >
      {visible ? (
        <div className="flex items-baseline gap-4">
          <span
            className={`font-[family-name:var(--font-silkscreen)] ${embedded.embedded ? "text-base" : "text-2xl"} font-bold tracking-[0.18em]`}
            style={{ color: "var(--slop-magenta, #ff3ec9)" }}
          >
            SLOP/AI WALLET
          </span>
          {!embedded.embedded && (
            <span
              className="font-[family-name:var(--font-silkscreen)] text-base tracking-[0.16em] hidden sm:inline"
              style={{ color: "var(--slop-text-muted, #7878a0)" }}
            >
              talk to your multisig
            </span>
          )}
          {embedded.embedded && embedded.multisigAddress && (
            <span
              className="font-[family-name:var(--font-silkscreen)] text-xs tracking-[0.12em]"
              style={{ color: "var(--slop-text-muted, #7878a0)" }}
              title={embedded.multisigAddress}
            >
              · {short(embedded.multisigAddress)}
              {embedded.chainId ? ` · chain ${embedded.chainId}` : ""}
            </span>
          )}
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-3">
        {/* Hide RainbowKit when embedded — the parent supplies the wallet context. */}
        {!embedded.embedded && <RainbowKitCustomConnectButton />}
      </div>
    </div>
  );
};
