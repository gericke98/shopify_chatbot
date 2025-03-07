import { ChatMessage, ClassifiedMessage } from "@/types";
import {
  extractCompleteOrder,
  extractProduct,
  trackOrder,
  updateShippingAddress,
} from "../queries/order";
import { aiService } from "./ai";
import { sendEmail } from "./mail";

export async function NoOrderNumberOrEmail(
  parameters: ClassifiedMessage["parameters"],
  context: ChatMessage[],
  language: string
): Promise<string> {
  const prompt =
    language === "Spanish"
      ? "¡Ey! Necesito el número de pedido (tipo #12345) y tu email para poder ayudarte 😊"
      : "Hey! I need your order number (like #12345) and email to help you out 😊";
  return await aiService.generateFinalAnswer(
    "order_tracking",
    parameters,
    null,
    prompt,
    context,
    language
  );
}

export async function InvalidCredentials(
  parameters: ClassifiedMessage["parameters"],
  context: ChatMessage[],
  language: string,
  error: "InvalidOrderNumber" | "EmailMismatch" | undefined
): Promise<string> {
  let prompt = "";
  if (error === "InvalidOrderNumber") {
    prompt =
      language === "Spanish"
        ? "¡Vaya! No encuentro ningún pedido con ese número 😅 ¿Puedes revisarlo y volver a intentarlo?"
        : "Oops! Can't find any order with that number 😅 Can you check and try again?";
  }

  if (error === "EmailMismatch") {
    prompt =
      language === "Spanish"
        ? "¡Ups! El email no coincide con el del pedido 🤔 ¿Puedes revisar si es el correcto?"
        : "Oops! The email doesn't match the order 🤔 Can you check if it's the right one?";
  }
  return await aiService.generateFinalAnswer(
    "order_tracking",
    parameters,
    null,
    prompt,
    context,
    language
  );
}

export async function handleOrderTracking(
  parameters: ClassifiedMessage["parameters"],
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { order_number, email } = parameters;

  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(parameters, context, language);
  }

  const shopifyData = await trackOrder(order_number, email);
  if (!shopifyData.success) {
    return await InvalidCredentials(
      parameters,
      context,
      language,
      shopifyData.error
    );
  }

  return await aiService.generateFinalAnswer(
    "order_tracking",
    parameters,
    shopifyData,
    "",
    context,
    language
  );
}

export async function handleDeliveryIssue(
  parameters: ClassifiedMessage["parameters"],
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  try {
    const { order_number, email } = parameters;
    if (!order_number || !email) {
      return await NoOrderNumberOrEmail(parameters, context, language);
    }
    const shopifyData = await trackOrder(order_number, email);
    if (!shopifyData.success) {
      return await InvalidCredentials(
        parameters,
        context,
        language,
        shopifyData.error
      );
    }
    if (parameters.order_number && parameters.email) {
      await sendEmail(
        "hello@shamelesscollective.com",
        parameters.order_number,
        parameters.email
      );
    } else {
      console.warn(
        "Missing order number or email for delivery issue notification"
      );
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }

  return await aiService.generateFinalAnswer(
    "delivery_issue",
    parameters,
    null,
    message,
    context,
    language
  );
}

export async function handleChangeDelivery(
  parameters: ClassifiedMessage["parameters"],
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { order_number, email, new_delivery_info, delivery_address_confirmed } =
    parameters;

  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(parameters, context, language);
  }

  const shopifyData = await extractCompleteOrder(order_number, email);
  if (!shopifyData.success) {
    return await InvalidCredentials(
      parameters,
      context,
      language,
      shopifyData.error
    );
  }

  if (!shopifyData?.success || !shopifyData?.order) {
    return await aiService.generateFinalAnswer(
      "change_delivery",
      parameters,
      shopifyData,
      message,
      context,
      language
    );
  }

  if (!shopifyData.order.fulfillments?.length) {
    if (!new_delivery_info) {
      return await aiService.confirmDeliveryAddress(
        parameters,
        message,
        context,
        language
      );
    }

    const addressValidation = await aiService.validateAddress(
      new_delivery_info
    );

    if (!addressValidation.formattedAddress) {
      return await aiService.confirmDeliveryAddress(
        parameters,
        message,
        context,
        language
      );
    }

    if (delivery_address_confirmed) {
      await updateShippingAddress(
        shopifyData.order.admin_graphql_api_id,
        addressValidation.formattedAddress,
        shopifyData.order.shipping_address
      );

      const confirmationMessage =
        language === "Spanish"
          ? `¡Perfecto! He actualizado la dirección de envío a:\n\n${addressValidation.formattedAddress}\n\n¡Tu pedido se enviará a esta nueva dirección! 📦✨`
          : `Perfect! I've updated the shipping address to:\n\n${addressValidation.formattedAddress}\n\nYour order will be shipped to this new address! 📦✨`;

      return confirmationMessage;
    }

    return await aiService.confirmDeliveryAddress(
      parameters,
      message,
      context,
      language
    );
  }

  return await aiService.generateFinalAnswer(
    "change_delivery",
    parameters,
    shopifyData,
    message,
    context,
    language
  );
}

export async function handleUpdateOrder(
  parameters: ClassifiedMessage["parameters"],
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { order_number, email, update_type } = parameters;

  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(parameters, context, language);
  }

  const shopifyData = await extractCompleteOrder(order_number, email);
  if (!shopifyData.success) {
    return await InvalidCredentials(
      parameters,
      context,
      language,
      shopifyData.error
    );
  }

  if (!update_type) {
    const prompt =
      language === "Spanish"
        ? "¿Qué te gustaría actualizar en tu pedido? ¿La dirección de envío o algún producto? 🤔"
        : "What would you like to update in your order? The shipping address or a product? 🤔";

    return await aiService.generateFinalAnswer(
      "update_order",
      parameters,
      shopifyData,
      prompt,
      context,
      language
    );
  }

  if (update_type === "shipping_address") {
    return await handleChangeDelivery(parameters, message, context, language);
  } else if (update_type === "product") {
    return await aiService.generateFinalAnswer(
      "update_order",
      parameters,
      shopifyData,
      "Para cambiar un producto en tu pedido, te recomendamos hacer una devolución y realizar un nuevo pedido. Puedes iniciar el proceso de devolución aquí: https://shameless-returns-web.vercel.app",
      context,
      language
    );
  }

  return await aiService.generateFinalAnswer(
    "update_order",
    parameters,
    shopifyData,
    message,
    context,
    language
  );
}

export async function handleProductInquiry(
  parameters: ClassifiedMessage["parameters"],
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { product_name } = parameters;

  const shopifyData = await extractProduct(product_name);

  if (!shopifyData?.success || !shopifyData?.product) {
    return await aiService.generateFinalAnswer(
      "product_inquiry",
      parameters,
      null,
      message,
      context,
      language
    );
  }

  return await aiService.generateFinalAnswer(
    "change_delivery",
    parameters,
    shopifyData,
    message,
    context,
    language
  );
}
