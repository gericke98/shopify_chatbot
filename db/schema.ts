import { relations } from "drizzle-orm";
import { text, pgTable, serial, boolean } from "drizzle-orm/pg-core";

// Creo una tabla que contenga las orders que han sido editadas
export const tickets = pgTable("tickets", {
  id: text("id").primaryKey().notNull(),
  orderNumber: text("order_number"),
  email: text("email"),
  name: text("name"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  status: text("status").notNull(),
  admin: boolean("admin").notNull().default(false),
});

export const ticketsRelations = relations(tickets, ({ many }) => ({
  messages: many(messages),
}));

export const messages = pgTable("messages", {
  id: serial("id").primaryKey().notNull(),
  sender: text("sender").notNull(),
  text: text("text").notNull(),
  timestamp: text("timestamp").notNull(),
  ticketId: text("ticket_id").references(() => tickets.id, {
    onDelete: "cascade",
  }),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  ticket: one(tickets, {
    fields: [messages.ticketId],
    references: [tickets.id],
  }),
}));

export const shops = pgTable("shops", {
  shop: text("shop").primaryKey().notNull(),
  accessToken: text("access_token").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// CODE TO UPDATE TABLA SCHEMA  npx drizzle-kit push:pg
