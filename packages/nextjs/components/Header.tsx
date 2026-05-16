"use client";

import React from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

export const Header = () => {
  const { isConnected } = useAccount();

  return (
    <div
      className="sticky lg:static top-0 min-h-0 shrink-0 z-20 px-4 sm:px-6 flex items-center justify-between"
      style={{
        backgroundColor: isConnected ? "var(--slop-bg, #06030d)" : "transparent",
        borderBottom: isConnected ? "1px solid rgba(255, 62, 201, 0.18)" : "none",
        height: "72px",
      }}
    >
      {isConnected ? (
        <div className="flex items-baseline gap-4">
          <span
            className="font-[family-name:var(--font-silkscreen)] text-2xl font-bold tracking-[0.18em]"
            style={{ color: "var(--slop-magenta, #ff3ec9)" }}
          >
            SLOP/AI WALLET
          </span>
          <span
            className="font-[family-name:var(--font-silkscreen)] text-base tracking-[0.16em] hidden sm:inline"
            style={{ color: "var(--slop-text-muted, #7878a0)" }}
          >
            talk to your multisig
          </span>
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-3">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
