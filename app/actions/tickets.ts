"use server";

import db from "@/db/drizzle";
import { messages, tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Message, Ticket, CustomerData } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Custom error types
class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Rate limiting implementation
const rateLimits = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 20; // 20 requests per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userRateLimit = rateLimits.get(identifier);

  if (!userRateLimit || now - userRateLimit.timestamp > RATE_LIMIT_WINDOW) {
    rateLimits.set(identifier, { count: 1, timestamp: now });
    return true;
  }

  if (userRateLimit.count >= MAX_REQUESTS) {
    return false;
  }

  userRateLimit.count += 1;
  return true;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

// Validation schemas
const ticketIdSchema = z.string().uuid({
  message: "Invalid ticket ID format. Must be a valid UUID.",
});

const messageSchema = z.object({
  sender: z.enum(["user", "bot", "admin"], {
    message: "Sender must be 'user', 'bot', or 'admin'",
  }),
  content: z.string().min(1, "Message content cannot be empty"),
  timestamp: z.string().optional(),
});

const customerDataSchema = z
  .object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
  })
  .optional();

// GET ACTIONS
export async function getTickets(): Promise<Ticket[]> {
  console.log("[ACTION] Getting all tickets");
  try {
    const tickets = await db.query.tickets.findMany();
    return tickets;
  } catch (error) {
    console.error("[ERROR] Failed to get tickets:", error);
    throw new DatabaseError("Failed to retrieve tickets", error);
  }
}

export async function getTicket(ticketId: string): Promise<Ticket | undefined> {
  try {
    // Validate input
    const validatedId = ticketIdSchema.parse(ticketId);

    console.log(`[ACTION] Getting ticket with ID: ${validatedId}`);
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, validatedId),
    });

    return ticket;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[VALIDATION ERROR] Invalid ticket ID: ${ticketId}`,
        error.errors
      );
      throw new ValidationError(
        `Invalid ticket ID: ${error.errors[0].message}`
      );
    }
    console.error(`[ERROR] Failed to get ticket ${ticketId}:`, error);
    throw new DatabaseError(
      `Failed to retrieve ticket with ID ${ticketId}`,
      error
    );
  }
}

export async function getMessages(ticketId: string): Promise<Message[]> {
  try {
    // Validate input
    const validatedId = ticketIdSchema.parse(ticketId);

    console.log(`[ACTION] Getting messages for ticket ID: ${validatedId}`);
    const messagesResponse = await db.query.messages.findMany({
      where: eq(messages.ticketId, validatedId),
    });

    return messagesResponse;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[VALIDATION ERROR] Invalid ticket ID: ${ticketId}`,
        error.errors
      );
      throw new ValidationError(
        `Invalid ticket ID: ${error.errors[0].message}`
      );
    }
    console.error(
      `[ERROR] Failed to get messages for ticket ${ticketId}:`,
      error
    );
    throw new DatabaseError(
      `Failed to retrieve messages for ticket ID ${ticketId}`,
      error
    );
  }
}

// POST ACTIONS
export async function createTicket(userMessage: Message) {
  console.log("[ACTION] Creating new ticket");

  try {
    // Validate input
    const validatedMessage = messageSchema.parse(userMessage);

    // Check rate limit using IP or some other identifier
    const identifier = "create-ticket"; // In production, use IP or user identifier
    if (!checkRateLimit(identifier)) {
      console.warn(`[RATE LIMIT] Create ticket request rate limited`);
      return {
        status: 429,
        error: "Too many requests. Please try again later.",
      };
    }

    // Use transaction to ensure both operations succeed or fail together
    return await db.transaction(async (tx) => {
      const newTicket = await tx
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

      await tx.insert(messages).values({
        sender: validatedMessage.sender,
        content: validatedMessage.content,
        timestamp: formatDate(new Date().toISOString()),
        ticketId: newTicket[0].id,
      });

      console.log(`[SUCCESS] Created ticket with ID: ${newTicket[0].id}`);
      return {
        status: 200,
        data: newTicket[0],
      };
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[VALIDATION ERROR] Invalid message data:", error.errors);
      return {
        status: 400,
        error: `Invalid message data: ${error.errors[0].message}`,
      };
    }
    console.error("[ERROR] Failed to create ticket:", error);
    return { status: 500, error: "Failed to create ticket" };
  }
}

export async function updateTicketWithOrderInfo(
  ticketId: string,
  orderNumber: string,
  email: string,
  customer: CustomerData | undefined
) {
  console.log(`[ACTION] Updating ticket ${ticketId} with order info`);

  try {
    // Validate inputs
    const validatedId = ticketIdSchema.parse(ticketId);
    const validatedOrderNumber = z.string().min(1).parse(orderNumber);
    const validatedEmail = z.string().email().parse(email);
    const validatedCustomer = customerDataSchema.parse(customer);

    // Check if ticket exists
    const existingTicket = await db.query.tickets.findFirst({
      where: eq(tickets.id, validatedId),
    });

    if (!existingTicket) {
      return { status: 404, error: "Ticket not found" };
    }

    const updatedTicket = await db
      .update(tickets)
      .set({
        orderNumber: validatedOrderNumber,
        email: validatedEmail,
        name: validatedCustomer
          ? `${validatedCustomer.first_name || ""} ${validatedCustomer.last_name || ""}`.trim()
          : null,
        updatedAt: formatDate(new Date().toISOString()),
      })
      .where(eq(tickets.id, validatedId))
      .returning();

    revalidatePath(`/`);
    console.log(`[SUCCESS] Updated ticket ${validatedId} with order info`);

    return {
      status: 200,
      data: updatedTicket[0],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[VALIDATION ERROR] Invalid data for ticket ${ticketId}:`,
        error.errors
      );
      return {
        status: 400,
        error: `Validation error: ${error.errors[0].message}`,
      };
    }
    console.error(
      `[ERROR] Failed to update ticket ${ticketId} with order info:`,
      error
    );
    return {
      status: 500,
      error: "Failed to update ticket with order information",
    };
  }
}

export async function updateTicketAdmin(ticketId: string, admin: boolean) {
  console.log(
    `[ACTION] Updating admin status for ticket ${ticketId} to ${admin}`
  );

  try {
    // Validate inputs
    const validatedId = ticketIdSchema.parse(ticketId);
    const validatedAdmin = z.boolean().parse(admin);

    // Check if ticket exists
    const existingTicket = await db.query.tickets.findFirst({
      where: eq(tickets.id, validatedId),
    });

    if (!existingTicket) {
      return { status: 404, error: "Ticket not found" };
    }

    const updatedTicket = await db
      .update(tickets)
      .set({
        admin: validatedAdmin,
        updatedAt: formatDate(new Date().toISOString()),
      })
      .where(eq(tickets.id, validatedId))
      .returning();

    revalidatePath("/");
    console.log(
      `[SUCCESS] Updated admin status for ticket ${validatedId} to ${validatedAdmin}`
    );

    return {
      status: 200,
      data: updatedTicket[0],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[VALIDATION ERROR] Invalid data for ticket ${ticketId}:`,
        error.errors
      );
      return {
        status: 400,
        error: `Validation error: ${error.errors[0].message}`,
      };
    }
    console.error(
      `[ERROR] Failed to update admin status for ticket ${ticketId}:`,
      error
    );
    return { status: 500, error: "Failed to update ticket admin status" };
  }
}

export async function addMessageToTicket(
  ticketId: string | undefined,
  message: Message
) {
  console.log(`[ACTION] Adding message to ticket ${ticketId}`);

  try {
    // Validate inputs
    if (!ticketId) {
      throw new ValidationError("Ticket ID is required");
    }

    const validatedId = ticketIdSchema.parse(ticketId);
    const validatedMessage = messageSchema.parse(message);

    // Check rate limit
    const identifier = `message-${validatedId}`; // In production, use IP or user identifier
    if (!checkRateLimit(identifier)) {
      console.warn(
        `[RATE LIMIT] Add message request rate limited for ticket ${validatedId}`
      );
      return {
        status: 429,
        error: "Too many requests. Please try again later.",
      };
    }

    // Check if ticket exists
    const existingTicket = await db.query.tickets.findFirst({
      where: eq(tickets.id, validatedId),
    });

    if (!existingTicket) {
      return { status: 404, error: "Ticket not found" };
    }

    await db.insert(messages).values({
      sender: validatedMessage.sender,
      content: validatedMessage.content,
      timestamp: formatDate(new Date().toISOString()),
      ticketId: validatedId,
    });

    // Update the ticket's updatedAt timestamp
    await db
      .update(tickets)
      .set({
        updatedAt: formatDate(new Date().toISOString()),
      })
      .where(eq(tickets.id, validatedId));

    revalidatePath(`/`);
    console.log(`[SUCCESS] Added message to ticket ${validatedId}`);

    return { status: 200, success: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(`[VALIDATION ERROR] ${error.message}`);
      return { status: 400, error: error.message };
    }
    if (error instanceof z.ZodError) {
      console.error(`[VALIDATION ERROR] Invalid message data:`, error.errors);
      return {
        status: 400,
        error: `Invalid message data: ${error.errors[0].message}`,
      };
    }
    console.error(
      `[ERROR] Failed to add message to ticket ${ticketId}:`,
      error
    );
    return { status: 500, error: "Failed to add message to ticket" };
  }
}
