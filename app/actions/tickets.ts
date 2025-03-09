"use server";

import db from "@/db/drizzle";
import { messages, tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Message, Ticket, CustomerData } from "@/types";
import { revalidatePath } from "next/cache";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};
// GET ACTIONS
export async function getTickets(): Promise<Ticket[]> {
  const tickets = await db.query.tickets.findMany();
  return tickets;
}

export async function getTicket(ticketId: string): Promise<Ticket | undefined> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  return ticket;
}

export async function getMessages(ticketId: string): Promise<Message[]> {
  const messagesResponse = await db.query.messages.findMany({
    where: eq(messages.ticketId, ticketId),
  });
  return messagesResponse;
}
// POST ACTIONS
export async function createTicket(userMessage: Message) {
  console.log("create ticket action");
  try {
    const newTicket = await db
      .insert(tickets)
      .values({
        id: crypto.randomUUID(),
        orderNumber: null,
        email: null,
        status: "open",
        createdAt: formatDate(new Date().toISOString()),
        updatedAt: formatDate(new Date().toISOString()),
        admin: false,
      })
      .returning();
    await db.insert(messages).values({
      sender: userMessage.sender,
      content: userMessage.content,
      timestamp: formatDate(new Date().toISOString()),
      ticketId: newTicket[0].id,
    });

    return {
      status: 200,
      data: newTicket[0],
    };
  } catch (error) {
    console.error("Database error:", error);
    return { status: 500, error: "Failed to create ticket" };
  }
}

export async function updateTicketWithOrderInfo(
  ticketId: string,
  orderNumber: string,
  email: string,
  customer: CustomerData | undefined
) {
  try {
    const updatedTicket = await db
      .update(tickets)
      .set({
        orderNumber,
        email,
        name: customer?.first_name + " " + customer?.last_name,
      })
      .where(eq(tickets.id, ticketId))
      .returning();
    revalidatePath(`/`);
    return {
      status: 200,
      data: updatedTicket[0],
    };
  } catch (error) {
    console.error("Database error:", error);
    return { status: 500, error: "Failed to update ticket" };
  }
}

export async function updateTicketAdmin(ticketId: string, admin: boolean) {
  console.log("admin:", admin);
  try {
    const updatedTicket = await db
      .update(tickets)
      .set({
        admin: admin,
      })
      .where(eq(tickets.id, ticketId))
      .returning();
    revalidatePath("/");
    return {
      status: 200,
      data: updatedTicket[0],
    };
  } catch (error) {
    console.error("Database error:", error);
    return { status: 500, error: "Failed to update ticket" };
  }
}

export async function addMessageToTicket(
  ticketId: string | undefined,
  message: Message
) {
  console.log("addMessageToTicket action");
  try {
    await db.insert(messages).values({
      sender: message.sender,
      content: message.content,
      timestamp: formatDate(new Date().toISOString()),
      ticketId,
    });

    revalidatePath(`/`);

    return { status: 200, success: true };
  } catch (error) {
    console.error("Database error:", error);
    return { status: 500, error: "Failed to add message to ticket" };
  }
}
