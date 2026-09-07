import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANA マイレージ＆PP計算シミュレーター | SFC修行・LTM管理ツール",
  description: "ANAのプレミアムポイント(PP)計算、PP単価自動算出、ライフタイムマイル(LTM)達成シミュレーションが無料でできるWebアプリ。",
  keywords: ["ANA", "プレミアムポイント", "PP計算", "SFC修行", "LTM", "ライフタイムマイル"],
  
  // 1. Google Search Console 所有権確認
  verification: {
    google: "Bt1a0jbzd-YvtIvzXwr12lm8HxyFSzRjpI4OBnKeuro",
  },

  // 3. X (旧Twitter) & OGP 設定
  openGraph: {
    title: "ANA マイレージ＆PP計算シミュレーター",
    description: "SFC修行・LTM管理を手軽にシミュレーションできるWebアプリ",
    url: "https://ana-mileage-app.vercel.app/", 
    siteName: "ANA マイレージ＆PP管理",
    images: [
      {
        url: "/og-image.png", // public/og-image.png を参照
        width: 1200,
        height: 630,
        alt: "ANA マイレージ＆PP計算シミュレーター",
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ANA マイレージ＆PP計算シミュレーター",
    description: "SFC修行のPP計算・LTM管理をスマートに。",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const GA_MEASUREMENT_ID = "G-QE04GYR3BK";

  return (
    <html lang="ja">
      <head>
        {/* AdSense コード */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7930224787140650"
          crossOrigin="anonymous"
        />
        {/* GA4 (Google Analytics) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}