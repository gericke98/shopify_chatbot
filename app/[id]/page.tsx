"use server";

import { getTicket } from "../actions/tickets";
import { getMessages } from "../actions/tickets";
import { Chat } from "../components/chat";

export default async function TicketPage({
  params,
}: {
  params: { id: string };
}) {
  const ticket = await getTicket(params.id);
  const messages = await getMessages(params.id);

  return <Chat inputmessages={messages} inputcurrentTicket={ticket} />;
}
