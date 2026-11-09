import type { Metadata, Viewport } from "next";
import { ColorSchemeScript } from "@mantine/core";
import "@mantine/core/styles.css";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = { title: "Raund ミラー（ローカル）", description: "nttw-demo のローカル再現環境" };
export const viewport: Viewport = { width: "device-width", themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
