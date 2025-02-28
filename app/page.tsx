"use client";
import { useState, useEffect, useRef, FormEvent } from "react";
import Image from "next/image";

interface Message {
  sender: "user" | "bot";
  text: string;
  timestamp: string;
}

export default function Home(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [language, setLanguage] = useState<"English" | "Spanish">("English");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add welcome message on first load
  useEffect(() => {
    const welcomeMessage =
      language === "English"
        ? "👋 Hi! I'm Santi from Shameless Collective. What can I help you with?"
        : "👋 Hola! Soy Santi de Shameless Collective. En qué te puedo ayudar?";

    setMessages([
      {
        sender: "bot",
        text: welcomeMessage,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, [language]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage) return;

    const context = messages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "system",
      content: msg.text,
    }));

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: trimmedMessage,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          context,
          language,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.response,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (error) {
      console.log(error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text:
            language === "English"
              ? "Sorry, something went wrong. Please try again."
              : "Lo siento, algo salió mal. Por favor, inténtalo de nuevo.",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto h-screen p-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="h-12 w-48 relative">
              <Image
                src="/logo.png"
                alt="Shameless Collective Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <select
              value={language}
              onChange={(e) =>
                setLanguage(e.target.value as "English" | "Spanish")
              }
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="English">English</option>
              <option value="Spanish">Español</option>
            </select>
          </div>
          <p className="text-lg text-gray-700 font-medium">
            {language === "English"
              ? "Customer Support Assistant"
              : "Asistente de Atención al Cliente"}
          </p>
        </header>

        {/* Chat Window */}
        <div className="h-[calc(100vh-280px)] border border-gray-200 rounded-xl p-6 overflow-y-auto bg-white shadow-lg">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex mb-6 ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div className="flex flex-col">
                <div
                  className={`max-w-[80%] px-6 py-4 rounded-2xl shadow-sm ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-xs text-gray-500 mt-1 mx-2">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex mb-6 justify-start">
              <div className="flex flex-col">
                <div className="max-w-[80%] px-6 py-4 rounded-2xl shadow-sm bg-gray-100">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder={
                language === "English"
                  ? "Type your message..."
                  : "Escribe tu mensaje..."
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 text-black border border-gray-300 rounded-xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-4 rounded-xl hover:opacity-90 transition-all disabled:from-gray-400 disabled:to-gray-500 shadow-sm"
            >
              {language === "English" ? "Send" : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
