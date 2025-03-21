import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import FloatingChat from "./components/FloatingChat";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shameless Collective Support",
  description: "Chat with our support team",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <FloatingChat />
      </body>
    </html>
  );
}
