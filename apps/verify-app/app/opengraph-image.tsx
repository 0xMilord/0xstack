import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: "#0a0a0a",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05 }}>0xstack</div>
        <div style={{ marginTop: 16, fontSize: 28, color: "#d4d4d4" }}>Production-ready starter</div>
      </div>
    ),
    size
  );
}
