"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import Script from "next/script";

const queryClient = new QueryClient();

export function ShopifyAppBridgeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script id="shopify-app-bridge" strategy="afterInteractive">
        {`
          const config = {
            apiKey: "${process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ""}",
            host: new URLSearchParams(window.location.search).get("host") || "",
          };
          window.app = window.createApp(config);
        `}
      </Script>
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
