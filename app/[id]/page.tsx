"use server";
import { revalidatePath } from "next/cache";
import { getTicket } from "../actions/tickets";
import { getMessages } from "../actions/tickets";
import { Chat } from "../components/chat";

export async function refreshTicketData(id: string) {
  "use server";
  console.log("Refreshing ticket data for:", id);
  revalidatePath(`/${id}`);
  return { success: true };
}

export default async function TicketPage({
  params,
}: {
  params: { id: string };
}) {
  const ticket = await getTicket(params.id);
  const messages = await getMessages(params.id);

  return (
    <Chat
      inputmessages={messages}
      inputcurrentTicket={ticket}
      ticketId={params.id}
    />
  );
}
