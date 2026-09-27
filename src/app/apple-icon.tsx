import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#e2ff3d" }}>
      <svg viewBox="0 0 32 32" width="180" height="180">
        <path d="M12.5 11.2 17.6 8h2.6v16h-3.9V13l-3.8 2.3z" fill="#0c1003" />
      </svg>
    </div>,
    size,
  );
}
