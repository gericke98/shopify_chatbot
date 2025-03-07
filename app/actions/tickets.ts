"use server";

import db from "@/db/drizzle";
import { messages, tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
type ChatMessage = {
  sender: "user" | "system" | "bot";
  text: string;
  timestamp: string;
};
export async function createTicket(userMessage: ChatMessage) {
  console.log("create ticket action");
  try {
    const newTicket = await db
      .insert(tickets)
      .values({
        id: crypto.randomUUID(),
        orderNumber: null,
        email: null,
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await db.insert(messages).values({
      sender: userMessage.sender,
      content: userMessage.text,
      timestamp: new Date().toISOString(),
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
  email: string
) {
  try {
    const updatedTicket = await db
      .update(tickets)
      .set({ orderNumber, email })
      .where(eq(tickets.id, ticketId))
      .returning();
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
  message: ChatMessage
) {
  try {
    await db.insert(messages).values({
      sender: message.sender,
      content: message.text,
      timestamp: message.timestamp,
      ticketId,
    });
  } catch (error) {
    console.error("Database error:", error);
    return { status: 500, error: "Failed to add message to ticket" };
  }
}
