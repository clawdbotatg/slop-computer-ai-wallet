"use client";

import { useEffect, useState } from "react";

// When this app runs inside live.slop.computer's iframe (?embedded=1),
// the parent renders its own custom cursor and wants to keep tracking
// the user's pointer even while it's over the iframe. We do two things:
//
//   1. Hide the system cursor everywhere inside the iframe via a global
//      `* { cursor: none !important }` rule, so nothing leaks through.
//   2. Forward every mousemove up to the parent as a postMessage with
//      iframe-viewport coords; the parent translates by the iframe's
//      bounding rect to render its custom cursor at the right spot.
//
// On non-embedded loads (visiting wallet.slop.computer directly) this
// component is a no-op.
export const EmbeddedCursorBridge = () => {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setEmbedded(params.get("embedded") === "1");
  }, []);

  useEffect(() => {
    if (!embedded) return;
    if (typeof window === "undefined" || window.parent === window) return;
    const onMove = (e: MouseEvent) => {
      window.parent.postMessage({ type: "slop:cursor", x: e.clientX, y: e.clientY }, "*");
    };
    const onLeave = () => {
      window.parent.postMessage({ type: "slop:cursor:leave" }, "*");
    };
    window.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [embedded]);

  if (!embedded) return null;
  return <style>{`* { cursor: none !important; }`}</style>;
};

export default EmbeddedCursorBridge;
