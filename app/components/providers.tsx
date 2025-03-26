"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { createApp } from "@shopify/app-bridge";
import "@shopify/polaris/build/esm/styles.css";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const queryClient = new QueryClient();

function AppBridgeProviderContent({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const [app, setApp] = useState<ReturnType<typeof createApp> | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsClient(true);
    const config = {
      apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || "",
      host: searchParams.get("host") || "",
    };
    const newApp = createApp(config);
    setApp(newApp);
  }, [searchParams]);

  if (!isClient || !app) {
    return <>{children}</>;
  }

  return <div data-shopify-app-bridge-provider>{children}</div>;
}

export function ShopifyAppBridgeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<>{children}</>}>
      <AppBridgeProviderContent>{children}</AppBridgeProviderContent>
    </Suspense>
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
