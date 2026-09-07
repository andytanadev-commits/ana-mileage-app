import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANA マイレージ＆PP計算シミュレーター | SFC修行・LTM管理ツール",
  description: "ANAのプレミアムポイント(PP)計算、PP単価自動算出、ライフタイムマイル(LTM)達成シミュレーションが無料でできるWebアプリ。CSV取込・クラウド同期対応。",
  keywords: ["ANA", "プレミアムポイント", "PP計算", "SFC修行", "LTM", "ライフタイムマイル", "マイレージ"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}