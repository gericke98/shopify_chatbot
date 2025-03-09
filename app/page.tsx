"use server";
import { redirect } from "next/navigation";
import { createTicket } from "./actions/tickets";

export default async function Home(): Promise<JSX.Element> {
  // Create a new ticket with welcome message
  const ticket = await createTicket({
    sender: "bot",
    content:
      "👋 Hi! I'm Santi from Shameless Collective. What can I help you with?",
    timestamp: new Date().toISOString(), // Use ISO string for consistency
  });

  // Redirect to the ticket page if created successfully
  if (ticket.status === 200 && ticket.data) {
    redirect(`/${ticket.data.id}`);
  }

  // Fallback UI in case of error
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8">
        <h1 className="text-xl font-semibold text-gray-800 mb-2">
          Creating your support session...
        </h1>
        <p className="text-gray-600">Please wait while we set up your chat.</p>
      </div>
    </div>
  );
}
