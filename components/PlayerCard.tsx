"use client";

import { useTheme } from "@/context/ThemeContext";
import { getTier } from "@/lib/playerCardTiers";

interface PlayerCardProps {
  ovr: number;
  name: string;
  spd: number;
  end: number;
  con: number;
  eff: number;
  tgh: number;
  prevOvr?: number;
  mode?: "dashboard" | "full";
}

function RunnerSilhouette({
  color = "white",
  size = 80,
}: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "block" }}
    >
      <circle cx="72" cy="18" r="8" fill={color} />
      <path d="M72 26 L65 50 L55 70" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M68 35 L82 42 L88 36" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M68 35 L56 42 L50 38" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M65 50 L75 68 L85 74" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M65 50 L55 65 L45 68" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M20 55 Q 30 50, 40 56" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.4" />
      <path d="M15 65 Q 28 60, 38 65" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.25" />
    </svg>
  );
}

export default function PlayerCard({
  ovr,
  name,
  spd,
  end,
  con,
  eff,
  tgh,
  prevOvr,
  mode = "dashboard",
}: PlayerCardProps) {
  const { theme } = useTheme();
  const tier = getTier(ovr);
  const attrs = [
    { key: "SPD", fullName: "Speed", val: spd, color: "var(--c-interval)" },
    { key: "END", fullName: "Endurance", val: end, color: "var(--c-long)" },
    { key: "CON", fullName: "Consistency", val: con, color: "var(--c-tempo)" },
    { key: "EFF", fullName: "HR Efficiency", val: eff, color: "var(--c-easy)" },
    { key: "TGH", fullName: "Toughness", val: tgh, color: "#f5b454" },
  ] as const;

  const isDashboard = mode === "dashboard";

  const layoutStyle = isDashboard
    ? {
        display: "flex",
        gap: "20px",
        alignItems: "center",
      }
    : {
        display: "grid",
        gap: "20px",
      };

  return (
    <div
      style={{
        background: theme === "light" ? tier.lightCardBg : tier.cardBg,
        border: `1px solid ${tier.borderColor}`,
        borderRadius: "16px",
        padding: isDashboard ? "20px" : "24px",
        position: "relative",
        overflow: "hidden",
        ...layoutStyle,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(45deg, ${tier.accentColor} 0px, ${tier.accentColor} 1px, transparent 1px, transparent 12px)`,
          opacity: tier.patternOpacity,
          pointerEvents: "none",
        }}
      />

      {tier.shimmer && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
            animation: "rs-shimmer 4s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}

      {isDashboard ? (
        <>
          <div style={{ position: "relative", zIndex: 1 }}>
            <RunnerSilhouette color={tier.accentColor} size={80} />
            <p style={{ fontWeight: 900, fontSize: "0.85rem", letterSpacing: "0.1em", color: theme === "light" ? "#111827" : "white", marginTop: "6px", textAlign: "center" }}>
              {name}
            </p>
            <p style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: tier.accentColor, textAlign: "center", opacity: 0.8 }}>
              RUNNING CARD
            </p>
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            <p
              style={{
                fontSize: "3.5rem",
                fontWeight: 900,
                lineHeight: 1,
                color: tier.ovrColor,
                fontFamily: "monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {ovr}
            </p>
            <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.15em", color: theme === "light" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)", marginTop: "2px" }}>
              O V R
            </p>
            {prevOvr !== undefined && ovr !== prevOvr && (
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: ovr > prevOvr ? "#4ade80" : "#f87171", marginTop: "4px" }}>
                {ovr > prevOvr ? "+" : ""}
                {ovr - prevOvr} OVR
              </p>
            )}
            <p style={{ fontSize: "0.65rem", color: tier.accentColor, fontWeight: 600, marginTop: "6px", letterSpacing: "0.05em" }}>
              {tier.name}
            </p>
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px 16px",
              marginLeft: "auto",
            }}
          >
            {attrs.map((attr) => (
              <div key={attr.key} style={{ textAlign: "center" }}>
                <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)" }}>{attr.key}</p>
                <p style={{ fontSize: "1.1rem", fontWeight: 900, fontFamily: "monospace", color: attr.color, lineHeight: 1.2 }}>
                  {attr.val}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            gap: "24px",
            alignItems: "center",
          }}
        >
          <div>
            <RunnerSilhouette color={tier.accentColor} size={120} />
            <p style={{ fontWeight: 900, fontSize: "0.95rem", letterSpacing: "0.1em", color: theme === "light" ? "#111827" : "white", marginTop: "8px", textAlign: "center" }}>
              {name}
            </p>
            <p style={{ fontSize: "0.65rem", letterSpacing: "0.15em", color: tier.accentColor, textAlign: "center", opacity: 0.8 }}>
              RUNNING CARD
            </p>
          </div>
          <div>
            <p
              className="text-7xl"
              style={{
                fontWeight: 900,
                lineHeight: 1,
                color: tier.ovrColor,
                fontFamily: "monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {ovr}
            </p>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", color: theme === "light" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)", marginTop: "2px" }}>
              O V R
            </p>
            {prevOvr !== undefined && ovr !== prevOvr && (
              <p style={{ fontSize: "0.85rem", fontWeight: 700, color: ovr > prevOvr ? "#4ade80" : "#f87171", marginTop: "4px" }}>
                {ovr > prevOvr ? "+" : ""}
                {ovr - prevOvr} OVR
              </p>
            )}
            <p style={{ fontSize: "0.9rem", color: tier.accentColor, fontWeight: 700, marginTop: "8px", letterSpacing: "0.04em" }}>
              {tier.name}
            </p>
          </div>
        </div>

      )}

      {!isDashboard && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gap: "10px",
            marginTop: "8px",
            paddingTop: "14px",
            borderTop: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          {attrs.map((attr) => {
            const width = Math.min(100, Math.max(0, (attr.val / 99) * 100));
            return (
              <div key={attr.key} style={{ display: "grid", gridTemplateColumns: "56px 1fr 38px 90px", gap: "10px", alignItems: "center" }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)" }}>{attr.key}</p>
                <div style={{ height: "10px", borderRadius: "999px", background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${width}%`, background: attr.color, borderRadius: "999px" }} />
                </div>
                <p style={{ fontSize: "0.95rem", fontWeight: 800, fontFamily: "monospace", color: attr.color, textAlign: "right" }}>{attr.val}</p>
                <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", textAlign: "right" }}>{attr.fullName}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
