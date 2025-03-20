"use server";

import { getTicket } from "../actions/tickets";
import { getMessages } from "../actions/tickets";
import { Chat } from "../components/chat";
import Image from "next/image";

export default async function TicketPage({
  params,
}: {
  params: { id: string };
}) {
  const ticket = await getTicket(params.id);
  const messages = await getMessages(params.id);

  if (!ticket || !messages) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg flex flex-col items-center">
          <div className="w-40 h-12 relative mb-6">
            <Image
              src="/logo.png"
              alt="Shameless Collective Logo"
              fill
              className="object-contain"
            />
          </div>
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
          <p className="text-gray-500 mt-4">Loading chat...</p>
        </div>
      </div>
    );
  }

  return <Chat inputmessages={messages} inputcurrentTicket={ticket} />;
}
