"use client";

import { useEffect } from "react";
import {
  ShopifyAppBridgeProvider,
  QueryProvider,
  PolarisProvider,
} from "./providers";
import FloatingChat from "./FloatingChat";

export default function ShopifyAppWrapper() {
  useEffect(() => {
    // Initialize Shopify App Bridge
    if (typeof window !== "undefined") {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@shopify/app-bridge@3";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <ShopifyAppBridgeProvider>
      <QueryProvider>
        <PolarisProvider>
          <FloatingChat />
        </PolarisProvider>
      </QueryProvider>
    </ShopifyAppBridgeProvider>
  );
}
