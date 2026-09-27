import { ImageResponse } from "next/og";

export const alt = "One Login: this month's money in, money out and profit on one screen.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: "#f2f5f1",
        background:
          "radial-gradient(900px 500px at 70% -10%, rgba(62,229,156,0.35), transparent 70%), #050706",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 34, fontWeight: 600 }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "#e2ff3d",
            display: "flex",
          }}
        >
          <svg viewBox="0 0 32 32" width="64" height="64">
            <path d="M12.5 11.2 17.6 8h2.6v16h-3.9V13l-3.8 2.3z" fill="#0c1003" />
          </svg>
        </div>
        One Login
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 34, color: "#a2aba5" }}>Profit this month</div>
        <div
          style={{
            fontSize: 190,
            fontWeight: 700,
            letterSpacing: -10,
            color: "#3ee59c",
            lineHeight: 1,
          }}
        >
          $8,420
        </div>
      </div>
      <div style={{ display: "flex", gap: 40, fontSize: 30, color: "#a2aba5" }}>
        <span>Money in</span>
        <span>Money out</span>
        <span>Profit</span>
        <span style={{ color: "#e2ff3d" }}>One screen.</span>
      </div>
    </div>,
    size,
  );
}
