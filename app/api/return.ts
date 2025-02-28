import { orders, productsOrder } from "@/db/schema";
import { db } from "@/lib/db";
import { OrderLineItem } from "@/types";

export async function returnFunction(order: any) {
  try {
    // First create the return/exhange request in the database
    // Insert order into database
    await db.insert(orders).values({
      id: order.id.toString() || "No information provided",
      orderNumber: order.name || "No information provided",
      subtotal: Math.round(Number(order.subtotal_price) * 100) || 0,
      email: order.contact_email || "No information provided",
      shippingName: order.shipping_address.name || "No information provided",
      shippingAddress1:
        order.shipping_address.address1 || "No information provided",
      shippingAddress2:
        order.shipping_address.address2 || "No information provided",
      shippingZip: order.shipping_address.zip || "No information provided",
      shippingCity: order.shipping_address.city || "No information provided",
      shippingProvince:
        order.shipping_address.province || "No information provided",
      shippingCountry:
        order.shipping_address.country || "No information provided",
      shippingPhone: order.shipping_address.phone || "No information provided",
    });
    // Insert order items
    await Promise.all(
      order.line_items.map(async (item: OrderLineItem) => {
        if (item.quantity <= 0) return;
        const priceWithDiscount =
          Number(item.price) - (item.discount_allocations?.[0]?.amount ?? 0);

        return db.insert(productsOrder).values({
          lineItemId: item.id.toString() || "No information provided",
          orderId: order.id.toString() || "No information provided",
          productId: item.product_id.toString() || "No information provided",
          title: item.title || "No information provided",
          variant_title: item.variant_title || "No information provided",
          variant_id: item.variant_id.toString() || "No information provided",
          price: priceWithDiscount.toString() || "No information provided",
          quantity: item.quantity || 0,
          changed: false,
          confirmed: false,
          credit: false,
          gift_card_id: null,
        });
      })
    );
    // First update the database
    await updateFinalOrder(order.id);

    // Then create shipping label and send email
    const statusLabel = await createShippingLabel(id);

    if (statusLabel !== 200) {
      // If label creation fails, undo database changes
      await updateFinalOrder(id, true, isCredit); // Assuming we add a revert parameter
      console.error("Failed to create shipping label");
    }
  } catch (error) {
    console.error("Error in order processing:", error);
    // Attempt to undo database changes if there was an error
    try {
      await updateFinalOrder(id, true, isCredit);
    } catch (undoError) {
      console.error("Failed to revert database changes:", undoError);
    }
  }
  redirect(`/success`);
}

export async function updateFinalOrder(id: string) {
  const totalOrder = await getOrderTotal(id);
  const products = await getOrderProductsById(id);
  await Promise.all(
    products.map((product) =>
      processProductReturn(
        { ...product, action: product.action || undefined },
        totalOrder,
        isCredit
      )
    )
  );
}
