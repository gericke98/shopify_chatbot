"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Chat } from "./chat";
import { createTicket } from "../actions/tickets";
import type { Message, Ticket } from "@/types";
import Head from "next/head";

interface FloatingChatProps {
  shop: string;
}

export default function FloatingChat({ shop }: FloatingChatProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTicket, setCurrentTicket] = useState<Ticket | undefined>(
    undefined
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [showUnreadBadge, setShowUnreadBadge] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const initializeChat = async () => {
      try {
        const initialMessage: Message = {
          text: "Hello! How can I help you today?",
          sender: "bot",
          timestamp: new Date().toISOString(),
          shop,
        };
        const response = await createTicket(initialMessage);
        if (response.status === 200 && response.data) {
          setCurrentTicket(response.data);
          setMessages([initialMessage]);
        } else {
          console.error("Failed to create ticket:", response.error);
        }
      } catch (error) {
        console.error("Error initializing chat:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();
  }, [shop]);

  // Show unread badge when new messages arrive and chat is closed
  useEffect(() => {
    if (!isVisible && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === "bot") {
        setShowUnreadBadge(true);
      }
    }
  }, [messages, isVisible]);

  if (!isClient) {
    return null;
  }

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </Head>
      <div className="fixed z-40 md:bottom-6 md:right-6 inset-0 md:inset-auto">
        <div className="h-full flex flex-col-reverse justify-end md:flex-col-reverse md:items-end md:gap-4">
          {isVisible && currentTicket && (
            <div
              className="bg-white shadow-xl overflow-hidden pointer-events-auto transition-all duration-300 ease-in-out z-[60]
              scale-100 opacity-100
              md:w-[400px] md:h-[600px] md:rounded-2xl md:mb-2
              w-full h-[85vh] rounded-t-2xl fixed bottom-0 left-0 right-0"
            >
              <div className="w-full h-full flex flex-col">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex justify-between items-center relative flex-shrink-0">
                  <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 relative overflow-hidden rounded-full bg-white p-1 ring-2 ring-white/50 shadow-lg">
                      <Image
                        src="/logo.png"
                        alt="Shameless Collective"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <h2 className="font-semibold text-white text-shadow">
                        Shameless Support
                      </h2>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <p className="text-sm text-blue-100">Online now</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 relative z-10">
                    <button
                      onClick={() => setIsVisible(false)}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm"
                      aria-label="Close chat"
                    >
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden bg-gradient-to-b from-gray-50 to-white">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <Chat
                      inputmessages={messages}
                      inputcurrentTicket={currentTicket}
                      onMessagesUpdate={setMessages}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="fixed bottom-4 right-4 z-50">
            {!isVisible ? (
              <button
                onClick={() => setIsVisible(true)}
                className="bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors"
                aria-label="Open chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </button>
            ) : null}
            {showUnreadBadge && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white animate-bounce z-20">
                1
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-blue-600/20 blur-xl rounded-full scale-150 animate-pulse pointer-events-none"></div>
          </div>
        </div>
      </div>
    </>
  );
}
