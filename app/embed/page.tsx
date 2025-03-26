"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FloatingChat from "../components/FloatingChat";

function ChatComponent() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") || "unknown";

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
