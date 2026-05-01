"use client";

import { useEffect, useState } from "react";

export function SplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "visible" | "fading">("hidden");

  useEffect(() => {
    // Only show in standalone PWA mode (installed on home screen)
    const mq = window.matchMedia("(display-mode: standalone)");
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!mq.matches && !iosStandalone) return;

    // Show only once per session
    if (sessionStorage.getItem("sk-splash")) return;
    sessionStorage.setItem("sk-splash", "1");

    setPhase("visible");

    const fadeTimer = setTimeout(() => setPhase("fading"), 1900);
    const hideTimer = setTimeout(() => setPhase("hidden"), 2500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <>
      <style>{`
        @keyframes sk-zoom {
          from { transform: scale(0.45); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes sk-pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.07); }
        }
        @keyframes sk-wipe-top {
          from { clip-path: inset(0 100% 0 0 round 4px); }
          to   { clip-path: inset(0 0%   0 0 round 4px); }
        }
        @keyframes sk-wipe-btm {
          from { clip-path: inset(0 100% 0 0 round 4px); }
          to   { clip-path: inset(0 0%   0 0 round 4px); }
        }
        @keyframes sk-fadein-dot {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes sk-fadein-circle {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes sk-slide-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sk-sub-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 0.55; transform: translateY(0); }
        }

        .sk-icon-wrap {
          animation: sk-zoom 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                     sk-pulse 1.2s ease-in-out 0.85s 1 forwards;
        }
        .sk-arc-top {
          animation: sk-wipe-top 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s both;
        }
        .sk-arc-btm {
          animation: sk-wipe-btm 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.42s both;
        }
        .sk-dot {
          animation: sk-fadein-dot 0.35s ease 0.75s both;
        }
        .sk-circle {
          animation: sk-fadein-circle 0.3s ease 0.1s both;
        }
        .sk-title {
          animation: sk-slide-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) 1.05s both;
        }
        .sk-sub {
          animation: sk-sub-in 0.4s ease 1.2s both;
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          transition: "opacity 0.6s ease",
          opacity: phase === "fading" ? 0 : 1,
          pointerEvents: phase === "fading" ? "none" : "auto",
        }}
      >
        {/* ── Logo icon ── */}
        <div className="sk-icon-wrap" style={{ marginBottom: 28 }}>
          <svg
            viewBox="0 5 73 90"
            width={88}
            height={88}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
          >
            <defs>
              <linearGradient id="sp-og" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF4D00" />
                <stop offset="50%" stopColor="#FF6A00" />
                <stop offset="100%" stopColor="#FF2A4D" />
              </linearGradient>
              <linearGradient id="sp-ob" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00B4D8" />
                <stop offset="100%" stopColor="#0077B6" />
              </linearGradient>
              <filter id="sp-shadow" x="-10%" y="-10%" width="130%" height="130%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.18" />
              </filter>
            </defs>

            {/* Degree circle — fades in first */}
            <circle
              className="sk-circle"
              cx="12" cy="12" r="5"
              stroke="url(#sp-og)" strokeWidth="3"
              filter="url(#sp-shadow)"
            />

            {/* Top arc — orange, wipes left → right */}
            <path
              className="sk-arc-top"
              d="M 70 15.4 A 40 40 0 0 0 10.1 47 L 28.2 47 A 22 22 0 0 1 61 30.9 Z"
              fill="url(#sp-og)"
              filter="url(#sp-shadow)"
            />

            {/* Bottom arc — blue, wipes slightly later */}
            <path
              className="sk-arc-btm"
              d="M 10.1 53 A 40 40 0 0 0 70 84.6 L 61 69.1 A 22 22 0 0 1 28.2 53 Z"
              fill="url(#sp-ob)"
              filter="url(#sp-shadow)"
            />

            {/* Centre dot — fades in last */}
            <g className="sk-dot">
              <path d="M 62.6 47 A 13 13 0 0 0 37.4 47 Z" fill="url(#sp-og)" filter="url(#sp-shadow)" />
              <path d="M 37.4 53 A 13 13 0 0 0 62.6 53 Z" fill="url(#sp-ob)" filter="url(#sp-shadow)" />
            </g>
          </svg>
        </div>

        {/* ── Brand name ── */}
        <div
          className="sk-title"
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <span
            style={{
              background: "linear-gradient(135deg, #FF4D00, #FF6A00, #FF2A4D)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            СМОЛЯН
          </span>
          <span
            style={{
              background: "linear-gradient(135deg, #00B4D8, #0077B6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            КЛИМА
          </span>
        </div>

        {/* ── Sub-title ── */}
        <p
          className="sk-sub"
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 500,
            color: "#64748b",
            letterSpacing: "0.04em",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          АДМИНИСТРАТИВЕН ПАНЕЛ
        </p>
      </div>
    </>
  );
}
