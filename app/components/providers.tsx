"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { createApp } from "@shopify/app-bridge";
import "@shopify/polaris/build/esm/styles.css";
import { useEffect } from "react";

declare global {
  interface Window {
    app: ReturnType<typeof createApp>;
  }
}

const queryClient = new QueryClient();

function AppBridgeInitializer() {
  useEffect(() => {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || "",
      host: new URLSearchParams(window.location.search).get("host") || "",
    };
    const app = createApp(config);
    window.app = app;
  }, []);

  return null;
}

export function ShopifyAppBridgeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppBridgeInitializer />
      <div data-shopify-app-bridge-provider>{children}</div>
    </>
  );
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export function PolarisProvider({ children }: { children: React.ReactNode }) {
  return (
    <PolarisAppProvider
      i18n={{
        Polaris: {
          ResourceList: {
            sortingLabel: "Sort by",
            defaultItemHeight: "44px",
          },
        },
      }}
    >
      {children}
    </PolarisAppProvider>
  );
}
