"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import FloatingChat from "../components/FloatingChat";

function ChatComponent() {
  const [isClient, setIsClient] = useState(false);
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") || "unknown";

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen w-full">
      <FloatingChat shop={shop} />
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatComponent />
    </Suspense>
  );
}
