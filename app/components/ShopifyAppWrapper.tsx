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
    // Load Shopify App Bridge script
    const script = document.createElement("script");
    script.src = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <ShopifyAppBridgeProvider>
      <QueryProvider>
        <PolarisProvider>
          <FloatingChat shop="admin" />
        </PolarisProvider>
      </QueryProvider>
    </ShopifyAppBridgeProvider>
  );
}
