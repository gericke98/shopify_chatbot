"use server";

import db from "@/db/drizzle";
import { tickets } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function createTicket() {
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
