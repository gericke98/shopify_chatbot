"use server";
import { redirect } from "next/navigation";
import { createTicket } from "./actions/tickets";

export default async function Home(): Promise<JSX.Element> {
  console.log("Home page loaded");

  let ticketData = null;
  let ticketInfo = null;
  let error = null;

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
      error = ticket.error || "Failed to create ticket";
      console.error("Failed to create ticket:", ticket);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error("Error creating ticket:", err);
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
          {error
            ? "Error creating support session"
            : "Creating your support session..."}
        </h1>
        {error ? (
          <div>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-gray-600">
              Please try again later or contact support.
            </p>
            <p className="text-gray-500 mt-4 text-xs">
              Note: If this is the first deployment, you may need to run
              database migrations.
            </p>
          </div>
        ) : (
          <p className="text-gray-600">
            Please wait while we set up your chat.
          </p>
        )}
        <div className="mt-4 text-xs text-gray-400">
          Debug info: {JSON.stringify(ticketInfo)}
        </div>
      </div>
    </div>
  );
}
