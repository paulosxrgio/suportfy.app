import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/inter";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Suportfy",
    template: "%s · Suportfy",
  },
  description: "Atendimento automatizado por IA para lojas Shopify.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${GeistMono.variable} antialiased`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
