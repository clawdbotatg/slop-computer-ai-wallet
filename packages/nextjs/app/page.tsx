"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import ActivityPanel from "~~/components/ActivityPanel";
import ChatMessageRenderer from "~~/components/ChatMessageRenderer";
import { useDetailModal } from "~~/components/DetailModal";
import MultiStepTransactionCard from "~~/components/MultiStepTransactionCard";
import TransactionCard from "~~/components/TransactionCard";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useEmbeddedContext } from "~~/hooks/useEmbeddedContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  hash: string;
  chain: string;
  type: string;
  status: string;
  minedAt: string;
  valueUsd: number | null;
  out: { symbol: string; amount: string; icon: string } | null;
  in: { symbol: string; amount: string; icon: string } | null;
  explorerUrl: string;
}

interface PortfolioAsset {
  blockchain: string;
  tokenName: string;
  tokenSymbol: string;
  positionType?: string;
  protocol?: string | null;
  balance: string;
  balanceUsd: string;
  tokenDecimals: number;
  contractAddress: string;
  thumbnail: string;
}

interface MultiStepTransactionData {
  message: string;
  steps: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    description: string;
    label: string;
  }[];
  delay: number;
  priceEth?: string;
  priceWei?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  transaction?: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    description: string;
    simulation?: {
      verified: boolean;
      changes: { direction: "in" | "out"; symbol: string; amount: string }[];
    };
    txHash?: `0x${string}`;
  };
  multistepTransaction?: MultiStepTransactionData;
  timestamp: number;
}

interface PendingActivity {
  id: string;
  txHash: string;
  chainId: number;
  type: string;
  outToken?: { symbol: string; amount: string };
  inToken?: { symbol: string; amount: string };
  isCrossChain?: boolean;
  addedAt: number;
}

interface ConfirmedTxInfo {
  txHash: string;
  chainId: number;
  type: "swap" | "bridge" | "send" | "wrap" | "other";
  outToken?: { symbol: string; amount: string };
  inToken?: { symbol: string; amount: string };
  isCrossChain?: boolean;
  toChainId?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHAIN_ICONS: Record<string, string> = {
  ethereum: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
  base: "https://icons.llamao.fi/icons/chains/rsz_base.jpg",
  arbitrum: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg",
  optimism: "https://icons.llamao.fi/icons/chains/rsz_optimism.jpg",
  polygon: "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg",
  bsc: "https://icons.llamao.fi/icons/chains/rsz_binance.jpg",
  avalanche: "https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg",
  gnosis: "https://icons.llamao.fi/icons/chains/rsz_xdai.jpg",
  xdai: "https://icons.llamao.fi/icons/chains/rsz_xdai.jpg",
  linea: "https://icons.llamao.fi/icons/chains/rsz_linea.jpg",
  scroll: "https://icons.llamao.fi/icons/chains/rsz_scroll.jpg",
  zksync: "https://icons.llamao.fi/icons/chains/rsz_zksync%20era.jpg",
  fantom: "https://icons.llamao.fi/icons/chains/rsz_fantom.jpg",
  monad: "https://icons.llamao.fi/icons/chains/rsz_monad.jpg",
  abstract: "https://icons.llamao.fi/icons/chains/rsz_abstract.jpg",
  celo: "https://icons.llamao.fi/icons/chains/rsz_celo.jpg",
};

const formatUsdValue = (value: string | number): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num < 0.01) return "<$0.01";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
};

const MAX_DISPLAY_ASSETS = 8;

// ─── Component ───────────────────────────────────────────────────────────────

const Home: NextPage = () => {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const embedded = useEmbeddedContext();

  // When embedded inside live.slop.computer the multisig address replaces
  // the EOA — portfolio + intent calls run against the multisig, signing
  // is bridged via postMessage in Phase 3. Standalone mode unchanged.
  const address = (embedded.multisigAddress ?? wagmiAddress) as `0x${string}` | undefined;
  const isConnected = embedded.embedded ? !!embedded.multisigAddress : wagmiConnected;

  // Slop fork: CV auth stripped. Forward an x-slop-address header so the
  // backend can log + correlate requests, but no signature is required.
  const isAuthed = isConnected;
  const authHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (address) h["x-slop-address"] = address;
    return h;
  }, [address]);
  const { openModal } = useDetailModal();
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const STORAGE_KEY = address ? `clawd-chat-${address.toLowerCase()}` : null;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const key = `clawd-chat-${address?.toLowerCase() || "anon"}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  const [defiPositions, setDefiPositions] = useState<PortfolioAsset[]>([]);
  const [totalBalanceUsd, setTotalBalanceUsd] = useState("0");
  const [totalPortfolioUsd, setTotalPortfolioUsd] = useState("0");
  const [change1dUsd, setChange1dUsd] = useState("0");
  const [change1dPct, setChange1dPct] = useState("0");
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [showAllAssets, setShowAllAssets] = useState(false);

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [pendingActivities, setPendingActivities] = useState<PendingActivity[]>([]);
  const [highlightedTokens, setHighlightedTokens] = useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = useState<"assets" | "activity">("assets");
  // Hide the chat overlay when the user is browsing the columns underneath
  // (assets / activity). Refocusing the input brings it back. Lets the user
  // see what's covered without dismissing chat history.
  const [chatHidden, setChatHidden] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!STORAGE_KEY || messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
      } catch {
        /* ignore */
      }
    }
  }, [messages, STORAGE_KEY]);

  useEffect(() => {
    if (!address) {
      setMessages([]);
      return;
    }
    try {
      const key = `clawd-chat-${address.toLowerCase()}`;
      const saved = localStorage.getItem(key);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setMessages([]);
    }
  }, [address]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // Slop fork: CV charge effect removed. App runs unmetered.

  const fetchPortfolio = useCallback(async () => {
    if (!address) return;
    setIsLoadingPortfolio(true);

    try {
      const res = await fetch(`/api/portfolio?address=${address}`, {
        headers: { ...(authHeaders ?? {}) },
      });
      const data = await res.json();
      if (data.error) {
        console.error("Portfolio error:", data.error);
        return;
      }
      setPortfolio(data.assets || []);
      setDefiPositions(data.defiPositions || []);
      setTotalBalanceUsd(data.totalBalanceUsd || "0");
      setTotalPortfolioUsd(data.totalPortfolioUsd || "0");
      setChange1dUsd(data.change1dUsd || "0");
      setChange1dPct(data.change1dPct || "0");
    } catch (e) {
      console.error("Failed to fetch portfolio:", e);
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [address, authHeaders]);

  const fetchActivity = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/activity?address=${address}`, {
        headers: { ...(authHeaders ?? {}) },
      });
      const data = await res.json();
      setActivity(data.items || []);
    } catch (e) {
      console.error("Failed to fetch activity:", e);
    }
  }, [address, authHeaders]);

  useEffect(() => {
    if (!address) {
      setPortfolio([]);
      setDefiPositions([]);
      setTotalBalanceUsd("0");
      setTotalPortfolioUsd("0");
      setChange1dUsd("0");
      setChange1dPct("0");
      setActivity([]);
      return;
    }

    fetchPortfolio();
    setTimeout(fetchActivity, 1500);
  }, [address, fetchPortfolio, fetchActivity]);

  // 60s portfolio poll
  useEffect(() => {
    if (!address) return;
    const interval = setInterval(fetchPortfolio, 60_000);
    return () => clearInterval(interval);
  }, [address, fetchPortfolio]);

  // ─── handleTxConfirmed ────────────────────────────────────────────────────

  const handleTxConfirmed = useCallback(
    (info: ConfirmedTxInfo) => {
      const pending: PendingActivity = {
        id: info.txHash,
        txHash: info.txHash,
        chainId: info.chainId,
        type: info.type === "swap" ? "trade" : info.type,
        outToken: info.outToken,
        inToken: info.inToken,
        isCrossChain: info.isCrossChain,
        addedAt: Date.now(),
      };
      setPendingActivities(prev => [pending, ...prev]);

      // Highlight affected tokens
      const affected = new Set<string>();
      if (info.outToken) affected.add(info.outToken.symbol.toUpperCase());
      if (info.inToken) affected.add(info.inToken.symbol.toUpperCase());
      setHighlightedTokens(affected);
      setTimeout(() => setHighlightedTokens(new Set()), 180_000);

      // Wait 15s then refetch
      setTimeout(async () => {
        await Promise.all([fetchPortfolio(), fetchActivity()]);
      }, 15_000);

      // Auto-drop pending after 2 minutes
      setTimeout(() => {
        setPendingActivities(prev => prev.filter(p => p.id !== info.txHash));
        setHighlightedTokens(new Set());
      }, 120_000);
    },
    [fetchPortfolio, fetchActivity],
  );

  const handlePendingMatched = useCallback((txHash: string) => {
    setPendingActivities(prev => prev.filter(p => p.txHash.toLowerCase() !== txHash.toLowerCase()));
  }, []);

  // ─── Intent processing ──────────────────────────────────────────────────

  const processIntent = useCallback(
    async (userText: string, conversation: ChatMessage[]) => {
      if (!address || !isAuthed) return;
      setIsProcessing(true);
      try {
        const res = await fetch("/api/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
          body: JSON.stringify({
            message: userText,
            address,
            portfolio,
            defiPositions,
            chainId: embedded.chainId ?? undefined,
            recentMessages: conversation.slice(-6).map(m => ({ role: m.role, content: m.content })),
            recentActivity: activity.slice(0, 50),
          }),
        });
        const data = await res.json();

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: data.message || "Something went wrong",
          transaction: data.type === "transaction" ? data.transaction : undefined,
          multistepTransaction:
            data.type === "multistep_transaction"
              ? {
                  message: data.message,
                  steps: data.steps,
                  delay: data.delay || 65000,
                  priceEth: data.priceEth,
                  priceWei: data.priceWei,
                }
              : undefined,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      } catch {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsProcessing(false);
      }
    },
    [address, isAuthed, authHeaders, portfolio, defiPositions, embedded.chainId, activity],
  );

  const handleSubmit = async () => {
    if (!message.trim() || !address || !isAuthed) return;
    const userMsg: ChatMessage = { role: "user", content: message, timestamp: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setMessage("");
    setChatHidden(false);
    await processIntent(message, next);
  };

  // Resume an in-flight request after page reload: if the last persisted
  // message is the user's (no assistant response yet), re-fire the intent.
  const resumedRef = useRef(false);
  useEffect(() => {
    resumedRef.current = false;
  }, [address]);
  useEffect(() => {
    if (resumedRef.current) return;
    if (!address || !isAuthed || isProcessing) return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "user") return;
    resumedRef.current = true;
    processIntent(last.content, messages);
  }, [address, isAuthed, messages, isProcessing, processIntent]);

  // ─── Computed ────────────────────────────────────────────────────────────

  const walletTotal = parseFloat(totalBalanceUsd) || 0;
  const defiTotal = parseFloat(totalPortfolioUsd) || 0;
  const grandTotal = walletTotal + defiTotal;
  const changeUsd = parseFloat(change1dUsd) || 0;
  const changePct = parseFloat(change1dPct) || 0;
  const isChangeNegative = changeUsd < 0;

  const displayedAssets = showAllAssets ? portfolio : portfolio.slice(0, MAX_DISPLAY_ASSETS);
  const hiddenCount = portfolio.length - MAX_DISPLAY_ASSETS;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex items-center flex-col flex-grow pt-2" style={{ backgroundColor: "var(--slop-bg, #06030d)" }}>
      <div className="px-5 w-full max-w-7xl">
        {!isConnected ? (
          <div
            className="fixed inset-0 flex flex-col items-center justify-center gap-8"
            style={{ background: "var(--slop-base)" }}
          >
            <div className="relative z-10 flex flex-col items-center gap-6">
              <h1
                className="font-[family-name:var(--font-silkscreen)] text-4xl sm:text-6xl font-bold tracking-[0.2em] text-center"
                style={{ color: "var(--slop-magenta)", textShadow: "0 0 24px rgba(255,62,201,0.45)" }}
              >
                SLOP/AI WALLET
              </h1>
              <p
                className="font-[family-name:var(--font-silkscreen)] text-base sm:text-lg tracking-[0.18em] text-center"
                style={{ color: "var(--slop-text-muted)" }}
              >
                talk to your multisig
              </p>
              <div className="h-px w-48" style={{ backgroundColor: "rgba(255, 62, 201, 0.35)" }} />
              <RainbowKitCustomConnectButton />
            </div>
          </div>
        ) : (
          <div className="mt-2">
            {/* TOP BAR — balance + connect button (replaces the old Header) */}
            <div
              className="flex items-center justify-between pb-3 mb-2"
              style={{ borderBottom: "1px solid rgba(255, 62, 201, 0.18)" }}
            >
              <div className="flex items-baseline gap-3">
                {isLoadingPortfolio ? (
                  <span className="loading loading-spinner loading-sm" style={{ color: "#ff3ec9" }}></span>
                ) : (
                  <>
                    <span
                      className="font-[family-name:var(--font-silkscreen)] text-2xl sm:text-3xl tracking-[0.08em]"
                      style={{ color: "var(--slop-magenta, #ff3ec9)" }}
                    >
                      {formatUsdValue(grandTotal)}
                    </span>
                    {changeUsd !== 0 && (
                      <span
                        className="font-[family-name:var(--font-jetbrains)] text-base"
                        style={{ color: isChangeNegative ? "#9B3D3D" : "#bcff5b" }}
                      >
                        {isChangeNegative ? "" : "+"}
                        {changePct.toFixed(1)}%
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">{!embedded.embedded && <RainbowKitCustomConnectButton />}</div>
            </div>

            {/* Tab switcher — only visible below md */}
            <div className="flex md:hidden mb-2" style={{ borderBottom: "1px solid rgba(255, 62, 201, 0.18)" }}>
              {(["assets", "activity"] as const).map(tab => {
                const active = mobileTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setMobileTab(tab)}
                    className="flex-1 px-4 py-2 text-xs font-[family-name:var(--font-silkscreen)] tracking-[0.15em] uppercase cursor-pointer transition-colors"
                    style={{
                      color: active ? "#ff3ec9" : "#7878a0",
                      borderBottom: active ? "2px solid #ff3ec9" : "2px solid transparent",
                      marginBottom: "-1px",
                      backgroundColor: "transparent",
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div
              className="flex flex-row gap-4 h-[calc(100vh-244px)] md:h-[calc(100vh-200px)]"
              onClick={() => setChatHidden(true)}
            >
              {/* LEFT: Your Assets */}
              <div
                className={`${mobileTab === "assets" ? "" : "hidden"} md:block flex-1 min-w-0 space-y-4 overflow-y-auto`}
              >
                <div
                  className="p-4 space-y-4"
                  style={{
                    backgroundColor: "#111111",
                    border: "1px solid rgba(255, 62, 201, 0.15)",
                  }}
                >
                  {/* WALLET section */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs tracking-[0.2em] uppercase" style={{ color: "#7878a0" }}>
                        Wallet
                      </span>
                      <span className="font-[family-name:var(--font-jetbrains)] text-sm" style={{ color: "#7878a0" }}>
                        {formatUsdValue(walletTotal)}
                      </span>
                    </div>

                    {isLoadingPortfolio ? (
                      <div className="text-center py-4" style={{ color: "#7878a0" }}>
                        Loading assets...
                      </div>
                    ) : portfolio.length === 0 ? (
                      <div className="text-center py-4" style={{ color: "#7878a0" }}>
                        No assets found
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {displayedAssets.map((asset, i) => {
                          const isHighlighted = highlightedTokens.has(asset.tokenSymbol.toUpperCase());
                          return (
                            <div
                              key={`${asset.blockchain}-${asset.contractAddress || "native"}-${i}`}
                              className="flex items-center justify-between py-2 px-2 -mx-2 transition-colors duration-300 hover:bg-white/[0.02] cursor-pointer"
                              style={{
                                borderBottom: "1px solid rgba(255, 62, 201, 0.06)",
                                backgroundColor: isHighlighted ? "rgba(255, 62, 201, 0.06)" : undefined,
                              }}
                              onClick={() =>
                                openModal({
                                  type: "portfolio_position",
                                  symbol: asset.tokenSymbol,
                                  tokenName: asset.tokenName,
                                  chain: asset.blockchain,
                                  balance: asset.balance,
                                  balanceUsd: asset.balanceUsd,
                                  contractAddress: asset.contractAddress,
                                  thumbnail: asset.thumbnail,
                                  protocol: asset.protocol ?? undefined,
                                  positionType: asset.positionType,
                                  walletAddress: address,
                                })
                              }
                            >
                              <div className="flex items-center gap-2">
                                <div className="relative w-7 h-7 shrink-0">
                                  {asset.thumbnail ? (
                                    <img
                                      src={asset.thumbnail}
                                      alt={asset.tokenSymbol}
                                      className="w-7 h-7 rounded-full"
                                      onError={e => {
                                        (e.target as HTMLImageElement).src = "";
                                        (e.target as HTMLImageElement).style.display = "none";
                                        const parent = (e.target as HTMLImageElement).parentElement;
                                        if (parent) {
                                          const fallback = document.createElement("div");
                                          fallback.className =
                                            "w-7 h-7 flex items-center justify-center text-xs font-bold absolute inset-0";
                                          fallback.style.backgroundColor = "#111111";
                                          fallback.style.border = "1px solid rgba(255, 62, 201, 0.2)";
                                          fallback.style.color = "#ff3ec9";
                                          fallback.textContent = asset.tokenSymbol.slice(0, 2);
                                          parent.appendChild(fallback);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="w-7 h-7 flex items-center justify-center text-xs font-[family-name:var(--font-cinzel)] font-semibold"
                                      style={{
                                        backgroundColor: "#111111",
                                        border: "1px solid rgba(255, 62, 201, 0.2)",
                                        color: "#ff3ec9",
                                      }}
                                    >
                                      {asset.tokenSymbol.slice(0, 1)}
                                    </div>
                                  )}
                                  {CHAIN_ICONS[asset.blockchain] && (
                                    <img
                                      src={CHAIN_ICONS[asset.blockchain]}
                                      alt={asset.blockchain}
                                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2"
                                      style={{ borderColor: "#111111" }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm" style={{ color: "#e8e0ff" }}>
                                    {asset.tokenSymbol}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-1 justify-end">
                                {isHighlighted && (
                                  <span
                                    className="loading loading-dots loading-xs"
                                    style={{ color: "#ff3ec9", width: "12px" }}
                                  />
                                )}
                                <div
                                  className="font-[family-name:var(--font-jetbrains)] text-sm"
                                  style={{ color: "#e8e0ff" }}
                                >
                                  {formatUsdValue(asset.balanceUsd)}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {!showAllAssets && hiddenCount > 0 && (
                          <button
                            className="w-full text-center text-sm py-2 transition-colors cursor-pointer"
                            style={{ color: "#ff3ec9" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#B8963E")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#ff3ec9")}
                            onClick={() => setShowAllAssets(true)}
                          >
                            and {hiddenCount} more...
                          </button>
                        )}
                        {showAllAssets && hiddenCount > 0 && (
                          <button
                            className="w-full text-center text-sm py-2 transition-colors cursor-pointer"
                            style={{ color: "#ff3ec9" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#B8963E")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#ff3ec9")}
                            onClick={() => setShowAllAssets(false)}
                          >
                            Show less
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* PORTFOLIO (DeFi) section */}
                  {defiPositions.length > 0 && (
                    <>
                      <div className="h-px" style={{ backgroundColor: "rgba(255, 62, 201, 0.15)" }} />
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs tracking-[0.2em] uppercase" style={{ color: "#7878a0" }}>
                            Portfolio
                          </span>
                          <span
                            className="font-[family-name:var(--font-jetbrains)] text-sm"
                            style={{ color: "#7878a0" }}
                          >
                            {formatUsdValue(defiTotal)}
                          </span>
                        </div>
                        <div className="space-y-0">
                          {defiPositions.map((pos, i) => (
                            <div
                              key={`defi-${pos.blockchain}-${pos.contractAddress || pos.tokenSymbol}-${i}`}
                              className="flex items-center justify-between py-1.5 px-2 -mx-2 transition-colors duration-300 hover:bg-white/[0.02] cursor-pointer"
                              style={{
                                borderBottom: "1px solid rgba(255, 62, 201, 0.06)",
                              }}
                              onClick={() =>
                                openModal({
                                  type: "portfolio_position",
                                  symbol: pos.tokenSymbol,
                                  tokenName: pos.tokenName,
                                  chain: pos.blockchain,
                                  balance: pos.balance,
                                  balanceUsd: pos.balanceUsd,
                                  contractAddress: pos.contractAddress,
                                  thumbnail: pos.thumbnail,
                                  protocol: pos.protocol ?? undefined,
                                  positionType: pos.positionType,
                                  walletAddress: address,
                                })
                              }
                            >
                              <div className="flex items-center gap-2">
                                <div className="relative w-7 h-7 shrink-0">
                                  {pos.thumbnail ? (
                                    <img
                                      src={pos.thumbnail}
                                      alt={pos.tokenSymbol}
                                      className="w-7 h-7 rounded-full"
                                      onError={e => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="w-7 h-7 flex items-center justify-center text-xs font-[family-name:var(--font-cinzel)] font-semibold"
                                      style={{
                                        backgroundColor: "#111111",
                                        border: "1px solid rgba(255, 62, 201, 0.2)",
                                        color: "#ff3ec9",
                                      }}
                                    >
                                      {pos.tokenSymbol.slice(0, 1)}
                                    </div>
                                  )}
                                  {CHAIN_ICONS[pos.blockchain] && (
                                    <img
                                      src={CHAIN_ICONS[pos.blockchain]}
                                      alt={pos.blockchain}
                                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                                      style={{ borderColor: "#111111" }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs" style={{ color: "#e8e0ff" }}>
                                    {pos.tokenSymbol}
                                  </div>
                                  <div className="text-[10px] capitalize" style={{ color: "#7878a0" }}>
                                    {pos.positionType}
                                    {pos.protocol ? ` · ${pos.protocol}` : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div
                                  className="font-[family-name:var(--font-jetbrains)] text-xs"
                                  style={{ color: "#e8e0ff" }}
                                >
                                  {formatUsdValue(pos.balanceUsd)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* RIGHT: Your Activity */}
              <div className={`${mobileTab === "activity" ? "" : "hidden"} md:block flex-1 min-w-0 overflow-y-auto`}>
                <ActivityPanel
                  address={address!}
                  initialItems={activity}
                  pendingActivities={pendingActivities}
                  onPendingMatched={handlePendingMatched}
                />
              </div>
            </div>

            {/* CHAT BACKDROP — dark grey at the bottom 1/8, fades up to transparent */}
            {(messages.length > 0 || isProcessing) && (
              <div
                className="fixed inset-x-0 z-30 pointer-events-none"
                style={{
                  bottom: "64px",
                  height: "28vh",
                  background:
                    "linear-gradient(to top, rgba(15, 15, 22, 0.9) 0%, rgba(15, 15, 22, 0.85) 60%, transparent 100%)",
                }}
              />
            )}

            {/* CHAT OVERLAY — content-driven height, transparent, fades older messages */}
            {(messages.length > 0 || isProcessing) && !chatHidden && (
              <div className="slop-chat-overlay fixed inset-x-0 z-40 pointer-events-none" style={{ bottom: "64px" }}>
                <div className="max-w-7xl mx-auto px-5">
                  <div
                    ref={chatScrollRef}
                    className="slop-chat-fade pointer-events-auto overflow-y-auto space-y-2 pb-2"
                    style={{ maxHeight: "50vh", paddingTop: "10vh" }}
                  >
                    {messages.map((msg, i) => (
                      <div key={i} className={`group flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className="relative max-w-[85%] px-3 py-1.5"
                          style={
                            msg.role === "user"
                              ? {
                                  backgroundColor: "rgba(255, 62, 201, 0.18)",
                                  border: "1px solid rgba(255, 62, 201, 0.25)",
                                  color: "#e8e0ff",
                                  backdropFilter: "blur(6px)",
                                }
                              : {
                                  backgroundColor: "rgba(17, 17, 17, 0.92)",
                                  border: "1px solid rgba(255, 62, 201, 0.15)",
                                  color: "#e8e0ff",
                                  backdropFilter: "blur(6px)",
                                }
                          }
                        >
                          <button
                            className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center text-xs leading-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{
                              backgroundColor: "#06030d",
                              border: "1px solid rgba(255, 62, 201, 0.4)",
                              color: "#7878a0",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#ff3ec9")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#7878a0")}
                            onClick={() =>
                              setMessages(prev => {
                                const next = prev.filter((_, idx) => idx !== i);
                                if (STORAGE_KEY) {
                                  if (next.length === 0) localStorage.removeItem(STORAGE_KEY);
                                  else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                                }
                                return next;
                              })
                            }
                            aria-label="Dismiss message"
                          >
                            ×
                          </button>
                          {msg.role === "assistant" ? (
                            <ChatMessageRenderer content={msg.content} portfolio={portfolio} />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap leading-snug m-0">{msg.content}</p>
                          )}

                          {msg.multistepTransaction && (
                            <MultiStepTransactionCard
                              tx={msg.multistepTransaction}
                              address={address!}
                              onConfirmed={handleTxConfirmed}
                            />
                          )}

                          {msg.transaction && !msg.multistepTransaction && (
                            <TransactionCard
                              tx={msg.transaction}
                              address={address!}
                              onConfirmed={handleTxConfirmed}
                              onTxHash={(hash: `0x${string}`) => {
                                setMessages(prev =>
                                  prev.map((m, idx) =>
                                    idx === i && m.transaction
                                      ? { ...m, transaction: { ...m.transaction, txHash: hash } }
                                      : m,
                                  ),
                                );
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {isProcessing && (
                      <div className="flex justify-start">
                        <div
                          className="px-3 py-1.5"
                          style={{
                            backgroundColor: "rgba(17, 17, 17, 0.92)",
                            border: "1px solid rgba(255, 62, 201, 0.15)",
                            backdropFilter: "blur(6px)",
                          }}
                        >
                          <span className="loading loading-dots loading-sm" style={{ color: "#ff3ec9" }}></span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* FIXED FOOTER: chat input */}
            <div
              className="fixed inset-x-0 bottom-0 z-50"
              style={{
                backgroundColor: "#06030d",
                borderTop: "1px solid rgba(255, 62, 201, 0.2)",
              }}
            >
              <div className="max-w-7xl mx-auto px-5 py-3 flex gap-2">
                <input
                  type="text"
                  placeholder={
                    mounted && !isAuthed
                      ? "Connect your wallet to continue"
                      : "Ask your wallet to do something — send, swap, bridge, check balances…"
                  }
                  className="flex-1 text-base px-4 py-2"
                  style={{
                    backgroundColor: "#111111",
                    border: "1px solid rgba(255, 62, 201, 0.15)",
                    color: "#e8e0ff",
                    outline: "none",
                    opacity: mounted && !isAuthed ? 0.5 : 1,
                  }}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onFocus={() => setChatHidden(false)}
                  onKeyDown={e => e.key === "Enter" && !isProcessing && (!mounted || isAuthed) && handleSubmit()}
                  disabled={isProcessing || (mounted && !isAuthed)}
                />
                <button
                  className="px-6 py-2 slop-btn cursor-pointer"
                  onClick={handleSubmit}
                  disabled={isProcessing || !message.trim()}
                >
                  {isProcessing ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    <span className="text-sm">→</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
