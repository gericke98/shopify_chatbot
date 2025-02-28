import { relations } from "drizzle-orm";
import { text, pgTable, integer, serial, boolean } from "drizzle-orm/pg-core";

// Creo una tabla que contenga las orders que han sido editadas
export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  email: text("email").notNull(),
  intent: text("intent").notNull(),
  context: text("context").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  status: text("status").notNull(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  subtotal: integer("subtotal").notNull(),
  email: text("email").notNull(),
  shippingName: text("shipping_name").notNull(),
  shippingAddress1: text("shipping_address1").notNull(),
  shippingAddress2: text("shipping_address2"),
  shippingZip: text("shipping_zip").notNull(),
  shippingCity: text("shipping_city").notNull(),
  shippingProvince: text("shipping_province").notNull(),
  shippingCountry: text("shipping_country").notNull(),
  shippingPhone: text("shipping_phone").notNull(),
  locator: text("locator"),
});

export const ordersRelations = relations(orders, ({ many }) => ({
  products: many(productsOrder),
}));

export const productsOrder = pgTable("productsorder", {
  id: serial("id").primaryKey(),
  lineItemId: text("line_item").notNull(),
  orderId: text("order_id").references(() => orders.id, {
    onDelete: "cascade",
  }),
  productId: text("product_id").notNull(),
  title: text("title").notNull(),
  variant_title: text("variant_title").notNull(),
  variant_id: text("variant_id").notNull(),
  price: text("price").notNull(),
  quantity: integer("quantity").notNull(),
  changed: boolean("changed").notNull(),
  action: text("action"),
  reason: text("reason"),
  notes: text("notes"),
  new_variant_title: text("new_variant_title"),
  new_variant_id: text("new_variant_id"),
  confirmed: boolean("confirmed"),
  return_id: text("return_id"),
  refunded: boolean("refunded"),
  credit: boolean("credit"),
  gift_card_id: text("gift_card_id"),
  return_line_item_id: text("return_line_item_id"),
});

export const productsOrderRelations = relations(productsOrder, ({ one }) => ({
  order: one(orders, {
    fields: [productsOrder.orderId],
    references: [orders.id],
  }),
}));

// CODE TO UPDATE TABLA SCHEMA  npx drizzle-kit push:pg
