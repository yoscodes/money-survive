import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #0b1220 0%, #05060a 100%)",
          color: "#e7e9ee",
          fontSize: 48,
          fontWeight: 700,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 16,
            borderRadius: 36,
            border: "2px solid rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 28,
            top: 26,
            width: 22,
            height: 22,
            borderRadius: 9999,
            background: "#dc143c",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          <span>あと</span>
          <span style={{ color: "#10b981", fontSize: 64 }}>何日</span>
        </div>
      </div>
    ),
    size,
  );
}
