"use server";
import { redirect } from "next/navigation";
import { createTicket } from "./actions/tickets";

export default async function Home(): Promise<JSX.Element> {
  console.log("Home page loaded");

  let ticketData = null;
  let ticketInfo = null;

  try {
    // Create a new ticket with welcome message
    const ticket = await createTicket({
      sender: "bot",
      text: "👋 Hi! I'm Santi from Shameless Collective. What can I help you with?",
      timestamp: new Date().toISOString(), // Use ISO string for consistency
    });
    ticketInfo = ticket;
    console.log("Ticket created:", JSON.stringify(ticket));

    // Store ticket data for redirection outside try-catch
    if (ticket.status === 200 && "data" in ticket && ticket.data?.id) {
      ticketData = ticket.data;
    } else {
      console.error("Failed to create ticket:", ticket);
    }
  } catch (error) {
    console.error("Error creating ticket:", error);
  }

  // Redirect outside of try-catch if ticket was created successfully
  if (ticketData?.id) {
    console.log("Redirecting to ticket:", ticketData.id);
    redirect(`/${ticketData.id}`);
  }

  // Fallback UI in case of error or if redirect doesn't work
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8">
        <h1 className="text-xl font-semibold text-gray-800 mb-2">
          Creating your support session... ${ticketData?.id}
          {JSON.stringify(ticketInfo)}
        </h1>
        <p className="text-gray-600">Please wait while we set up your chat.</p>
      </div>
    </div>
  );
}
