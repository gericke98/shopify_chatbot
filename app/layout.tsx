import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import {
  ShopifyAppBridgeProvider,
  QueryProvider,
  PolarisProvider,
} from "./components/providers";
import FloatingChat from "./components/FloatingChat";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shameless Chatbot",
  description: "A chatbot for your Shopify store",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </head>
      <body className={inter.className}>
        <ShopifyAppBridgeProvider>
          <QueryProvider>
            <PolarisProvider>
              {children}
              <FloatingChat shop="default" />
            </PolarisProvider>
          </QueryProvider>
        </ShopifyAppBridgeProvider>
      </body>
    </html>
  );
}
