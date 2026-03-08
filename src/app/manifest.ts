import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "money-survive",
    short_name: "money-survive",
    description: "あと何日をひと目で確認できる家計サバイバルアプリ",
    start_url: "/dashboard",
    id: "/dashboard",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#05060a",
    theme_color: "#05060a",
    lang: "ja",
    orientation: "portrait",
    categories: ["finance", "productivity", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "あと何日を見る",
        short_name: "ダッシュボード",
        url: "/dashboard",
      },
      {
        name: "クエストを見る",
        short_name: "クエスト",
        url: "/quests",
      },
      {
        name: "ライバルを見る",
        short_name: "ライバル",
        url: "/map",
      },
    ],
  };
}
