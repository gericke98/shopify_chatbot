"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import FloatingChat from "../components/FloatingChat";

export default function EmbedPage() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");

  useEffect(() => {
    // Handle communication with parent window
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://shopify-chatbot-two.vercel.app") return;

      // Handle any messages from the parent window
      console.log("Received message:", event.data);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="h-screen w-full">
      <FloatingChat shop={shop || ""} />
    </div>
  );
}
