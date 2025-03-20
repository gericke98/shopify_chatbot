"use client";
import { toast, Toaster } from "sonner";
import Image from "next/image";
import { Message, Ticket } from "@/types";
import { addMessageToTicket } from "../actions/tickets";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";

type ChatProps = {
  inputmessages: Message[];
  inputcurrentTicket: Ticket | undefined;
};

export const Chat = ({ inputmessages, inputcurrentTicket }: ChatProps) => {
  const [language, setLanguage] = useState<"English" | "Spanish">("English");
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [messages, setMessages] = useState<Message[]>(inputmessages);
  const [currentTicket, setCurrentTicket] = useState<Ticket | undefined>(
    inputcurrentTicket
  );
  const [retryCount, setRetryCount] = useState<number>(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const MAX_RETRIES = 3;

  // Initial setup from props
  useEffect(() => {
    try {
      setMessages(inputmessages);
      setCurrentTicket(inputcurrentTicket);
    } catch (error) {
      toast.error(`Error loading initial data: ${error}`, {
        duration: 5000,
        position: "top-center",
      });
    } finally {
      setIsInitialLoading(false);
    }
  }, [inputmessages, inputcurrentTicket]);

  // Load messages from local storage on initial render
  useEffect(() => {
    const storedMessages = localStorage.getItem(
      `chat-messages-${inputcurrentTicket?.id}`
    );
    if (storedMessages) {
      setMessages(JSON.parse(storedMessages));
    } else {
      setMessages(inputmessages);
    }
  }, [inputcurrentTicket?.id, inputmessages]);

  // Save messages to local storage whenever they change
  useEffect(() => {
    if (inputcurrentTicket?.id && messages.length > 0) {
      localStorage.setItem(
        `chat-messages-${inputcurrentTicket.id}`,
        JSON.stringify(messages)
      );
    }
  }, [messages, inputcurrentTicket?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    scrollToBottom();

    // For cases where images might load after render
    const timeoutId = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timeoutId);
  }, [messages]);

  const errorMessageByLanguage = useMemo(
    () => ({
      English: "Sorry, something went wrong. Please try again.",
      Spanish: "Lo siento, algo salió mal. Por favor, inténtalo de nuevo.",
    }),
    []
  );

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setLanguage(e.target.value as "English" | "Spanish");
    },
    []
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputMessage(e.target.value);
    },
    []
  );

  const sendMessageToAI = async (
    message: string,
    context: { role: string; content: string }[],
    language: "English" | "Spanish",
    ticket?: Ticket
  ): Promise<void> => {
    try {
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context,
          language,
          currentTicket: ticket,
        }),
      });

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
      }

      const data = await res.json();

      if (data.updatedTicket) {
        setCurrentTicket(data.updatedTicket.data);
      }

      const botMessage = {
        sender: "bot" as const,
        text: data.response,
        timestamp: new Date().toLocaleTimeString(),
      };

      // Add bot message to UI immediately
      setMessages((prev) => [...prev, botMessage]);

      // Then send to server
      await addMessageToTicket(currentTicket?.id, botMessage);
    } catch (error) {
      // Implement retry logic
      if (retryCount < MAX_RETRIES) {
        setRetryCount((prev) => prev + 1);
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
        return sendMessageToAI(message, context, language, ticket);
      }
      throw error; // Re-throw if max retries exceeded
    }
  };

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      const trimmedMessage = inputMessage.trim();
      if (!trimmedMessage) return;

      const userMessage = {
        sender: "user" as const,
        text: trimmedMessage,
        timestamp: new Date().toLocaleTimeString(),
      };

      setInputMessage("");
      setIsLoading(true);
      setRetryCount(0);

      try {
        // Add user message to UI immediately
        setMessages((prev) => [...prev, userMessage]);

        // Send message to server
        await addMessageToTicket(currentTicket?.id, userMessage);

        if (!currentTicket?.admin) {
          const context = messages.map((msg) => ({
            role: msg.sender === "user" ? "user" : "system",
            content: msg.text,
          }));

          // Only call AI if no admin has taken over
          await sendMessageToAI(
            trimmedMessage,
            context,
            language,
            currentTicket
          );
        }
      } catch (error) {
        console.error("Error submitting message:", error);
        const errorMessage = errorMessageByLanguage[language];

        toast.error(errorMessage, {
          duration: 5000,
          position: "top-center",
        });

        // Remove the optimistically added message on error
        setMessages((prev) => prev.filter((msg) => msg !== userMessage));
      } finally {
        setIsLoading(false);
      }
    },
    [messages, inputMessage, currentTicket, language, errorMessageByLanguage]
  );

  const placeholderText = useMemo(
    () =>
      language === "English" ? "Type your message..." : "Escribe tu mensaje...",
    [language]
  );

  const buttonText = useMemo(
    () => (language === "English" ? "Send" : "Enviar"),
    [language]
  );

  const headerText = useMemo(
    () =>
      language === "English"
        ? "Customer Support Assistant"
        : "Asistente de Atención al Cliente",
    [language]
  );

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
          <div
            className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: "0.2s" }}
          ></div>
          <div
            className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: "0.4s" }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Toaster />
      <div className="max-w-4xl mx-auto min-h-screen p-4 sm:p-6">
        {/* Enhanced Header */}
        <header className="mb-4 sm:mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 mb-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-40 sm:h-12 sm:w-48 relative">
                <Image
                  src="/logo.png"
                  alt="Shameless Collective Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="h-6 w-px bg-gray-200 hidden sm:block" />
              <p className="text-base sm:text-lg text-gray-700 font-medium hidden sm:block">
                {headerText}
              </p>
            </div>

            {/* Enhanced Language Selector */}
            <select
              value={language}
              onChange={handleLanguageChange}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 
                focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-gray-300 
                transition-colors duration-200"
            >
              <option value="English">🇬🇧 English</option>
              <option value="Spanish">🇪🇸 Español</option>
            </select>
          </div>
          <p className="text-base sm:text-lg text-gray-700 font-medium text-center sm:hidden">
            {headerText}
          </p>
        </header>

        {/* Enhanced Chat Window */}
        <div
          className="h-[calc(100vh-280px)] sm:h-[calc(100vh-300px)] border border-gray-200 rounded-xl 
          p-4 sm:p-6 overflow-y-auto bg-white shadow-lg backdrop-blur-sm"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex mb-4 sm:mb-6 ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {/* Bot Avatar for non-user messages */}
              {msg.sender !== "user" && (
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-2 flex-shrink-0 border border-gray-100">
                  <Image
                    src="/logo.png"
                    alt="Shameless Collective"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
              )}

              <div className="flex flex-col max-w-[90%] sm:max-w-[80%]">
                <div
                  className={`px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-sm 
                    ${
                      msg.sender === "user"
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                        : "bg-gray-50 text-gray-900 border border-gray-100"
                    } transition-all duration-200 hover:shadow-md`}
                >
                  {msg.text}
                </div>
                <span
                  className={`text-[10px] sm:text-xs text-gray-500 mt-1 mx-2
                  ${msg.sender === "user" ? "text-right" : "text-left"}`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {/* User Avatar for user messages */}
              {msg.sender === "user" && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center ml-2 flex-shrink-0">
                  <span className="text-white text-sm">👤</span>
                </div>
              )}
            </div>
          ))}

          {/* Enhanced Loading Indicator */}
          {isLoading && (
            <div className="flex mb-4 sm:mb-6 justify-start items-center">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-2 flex-shrink-0 border border-gray-100">
                <Image
                  src="/logo.png"
                  alt="Shameless Collective"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <div className="bg-gray-50 px-4 py-3 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Enhanced Chat Input */}
        <form onSubmit={handleSubmit} className="mt-4 sm:mt-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <input
              type="text"
              placeholder={placeholderText}
              value={inputMessage}
              onChange={handleInputChange}
              className="flex-1 text-black border border-gray-200 rounded-xl px-4 sm:px-6 py-3 sm:py-4 
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                placeholder:text-gray-400 transition-all duration-200"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-blue-600 text-white 
                px-6 sm:px-8 py-3 sm:py-4 rounded-xl hover:opacity-90 transition-all duration-200
                disabled:from-gray-400 disabled:to-gray-500 shadow-sm hover:shadow-md
                flex items-center justify-center gap-2"
            >
              {buttonText}
              {!isLoading && <span>→</span>}
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
