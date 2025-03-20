import { ClassifiedMessage, OpenAIMessage } from "@/types";
import {
  extractCompleteOrder,
  extractProduct,
  trackOrder,
  updateShippingAddress,
} from "../queries/order";
import { aiService } from "./ai";
import { sendEmail } from "./mail";

// Types for size management
type SizeChart = {
  sizes: Size[];
  measurements: MeasurementType[];
  productType: string;
};

type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL" | "ONE SIZE";

type MeasurementType = {
  name: string; // e.g., "Chest", "Length", "Sleeve", "Waist"
  unit: "cm" | "in"; // centimeters or inches
  values: {
    [key in Size]?: number;
  };
};

// Example size chart for different product types
const sizeCharts: Record<string, SizeChart> = {
  CREWNECK: {
    sizes: ["XS", "S", "M", "L", "XL"],
    measurements: [
      {
        name: "Chest",
        unit: "cm",
        values: {
          XS: 64,
          S: 67,
          M: 70,
          L: 73,
          XL: 76,
        },
      },
      {
        name: "Length",
        unit: "cm",
        values: {
          XS: 65,
          S: 68,
          M: 71,
          L: 74,
          XL: 77,
        },
      },
      {
        name: "Sleeve",
        unit: "cm",
        values: {
          XS: 47,
          S: 48,
          M: 49,
          L: 50,
          XL: 51,
        },
      },
    ],
    productType: "Crewneck",
  },
  SWEATSHIRT: {
    sizes: ["S", "M", "L", "XL"],
    measurements: [
      {
        name: "Chest",
        unit: "cm",
        values: {
          S: 67,
          M: 69,
          L: 71,
          XL: 73,
        },
      },
      {
        name: "Length",
        unit: "cm",
        values: {
          S: 65,
          M: 68,
          L: 71,
          XL: 74,
        },
      },
      {
        name: "Sleeve",
        unit: "cm",
        values: {
          S: 58,
          M: 60,
          L: 62,
          XL: 64,
        },
      },
    ],
    productType: "Sweatshirt",
  },
  HOODIE: {
    sizes: ["S", "M", "L", "XL"],
    measurements: [
      {
        name: "Chest",
        unit: "cm",
        values: {
          S: 67,
          M: 69,
          L: 71,
          XL: 73,
        },
      },
      {
        name: "Length",
        unit: "cm",
        values: {
          S: 65,
          M: 68,
          L: 71,
          XL: 74,
        },
      },
      {
        name: "Sleeve",
        unit: "cm",
        values: {
          S: 58,
          M: 60,
          L: 62,
          XL: 64,
        },
      },
    ],
    productType: "Hoodie",
  },
  POLO: {
    sizes: ["XS", "S", "M", "L", "XL"],
    measurements: [
      {
        name: "Chest",
        unit: "cm",
        values: {
          XS: 64,
          S: 66,
          M: 68,
          L: 70,
          XL: 72,
        },
      },
      {
        name: "Length",
        unit: "cm",
        values: {
          XS: 63,
          S: 66,
          M: 69,
          L: 71,
          XL: 74,
        },
      },
      {
        name: "Sleeve",
        unit: "cm",
        values: {
          XS: 48,
          S: 49,
          M: 50,
          L: 51,
          XL: 52,
        },
      },
    ],
    productType: "Polo",
  },
};

export async function NoOrderNumberOrEmail(language: string): Promise<string> {
  const prompt =
    language === "Spanish"
      ? "Perfecto! Necesito el número de pedido (tipo #12345) y tu email para poder ayudarte 😊"
      : "Hey! I need your order number (like #12345) and email to help you out 😊";
  return prompt;
}

export async function InvalidCredentials(
  parameters: ClassifiedMessage["parameters"],
  context: OpenAIMessage[],
  language: string,
  error: "InvalidOrderNumber" | "EmailMismatch" | undefined
): Promise<string> {
  let prompt = "";
  console.log("error", error);
  if (error === "InvalidOrderNumber") {
    console.log("InvalidOrderNumber");
    prompt =
      language === "Spanish"
        ? "¡Vaya! No encuentro ningún pedido con ese número 😅 ¿Puedes revisarlo y volver a intentarlo?"
        : "Oops! Can't find any order with that number 😅 Can you check and try again?";
  }

  if (error === "EmailMismatch") {
    console.log("EmailMismatch");
    prompt =
      language === "Spanish"
        ? "¡Ups! El email no coincide con el del pedido 🤔 ¿Puedes revisar si es el correcto?"
        : "Oops! The email doesn't match the order 🤔 Can you check if it's the right one?";
  }
  return prompt;
}

export async function handleOrderTracking(
  parameters: ClassifiedMessage["parameters"],
  context: OpenAIMessage[],
  language: string
): Promise<string> {
  const { order_number, email } = parameters;

  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(language);
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
  context: OpenAIMessage[],
  language: string
): Promise<string> {
  try {
    const { order_number, email } = parameters;
    if (!order_number || !email) {
      return await NoOrderNumberOrEmail(language);
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
  context: OpenAIMessage[],
  language: string
): Promise<string> {
  const { order_number, email, new_delivery_info, delivery_address_confirmed } =
    parameters;

  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(language);
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
    // Caso de que todavía no se ha enviado el pedido
    if (!new_delivery_info) {
      return await aiService.confirmDeliveryAddress(
        parameters,
        message,
        context,
        language
      );
    }

    const addressValidation =
      await aiService.validateAddress(new_delivery_info);
    console.log("addressValidation", addressValidation);
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
  } else {
    console.log("Pedido ya enviado");
    console.log(shopifyData.order.fulfillments);
    if (!new_delivery_info) {
      // Preguntar la nueva dirección
      return await aiService.confirmDeliveryAddress(
        parameters,
        message,
        context,
        language
      );
    }

    const addressValidation =
      await aiService.validateAddress(new_delivery_info);
    console.log("addressValidation", addressValidation);
    console.log(delivery_address_confirmed);
    if (!addressValidation.formattedAddress) {
      return await aiService.confirmDeliveryAddress(
        parameters,
        message,
        context,
        language
      );
    }

    if (delivery_address_confirmed) {
      console.log("Entro en inicio de llamada");
      // Make an outbound call to notify about the address change
      try {
        // Aquí iría el teléfono de la empresa de envíos
        const phoneNumber = "+34608667749";

        if (phoneNumber) {
          // Prepare the prompt for the outbound call
          const callPrompt = `Eres una persona llamada Silvia. Estás llamando a una empresa de envíos para modificar la dirección de envío de tu paquete. Responde en 3 a 7 oraciones en la mayoría de los casos.
                Si te pregunta, aquí tienes información adicional sobre el pedido: 
                - Número de seguimiento ${shopifyData.order.fulfillments[0].tracking_number}
                - Nueva dirección de entrega: ${addressValidation.formattedAddress}
                Actúa como el cliente y no como un agente, es decir, la persona a la que llamas te tiene que dar la solución, tú no le tienes que ayudar en resolver sus problemas.`;
          console.log("callPrompt", callPrompt);

          const firstMessage =
            language === "Spanish"
              ? `Hola, soy Silvia. Llamo para cambiar la dirección de envío de mi pedido`
              : `Hello, this is Silvia. I'm calling to change the delivery address of my order.`;

          // Make the outbound call request
          const callResponse = await fetch(
            `${process.env.OUTBOUND_CALL_URL || "https://c110-81-33-205-107.ngrok-free.app"}/outbound-call`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                prompt: callPrompt,
                first_message: firstMessage,
                number: phoneNumber,
              }),
            }
          );

          const callData = await callResponse.json();
          if (!callData.success) {
            throw new Error(callData.error || "Failed to initiate call");
          }

          const callSid = callData.callSid;

          // Wait for the call to complete using polling
          let callCompleted = false;
          const maxWaitTime = 300; // 5 minutes in seconds
          let waitedTime = 0;

          while (!callCompleted && waitedTime < maxWaitTime) {
            // Wait 5 seconds between checks
            await new Promise((resolve) => setTimeout(resolve, 5000));
            waitedTime += 5;

            try {
              // Check if the call has completed
              console.log(
                `Checking call status for ${callSid}, waited ${waitedTime} seconds`
              );

              try {
                const statusResponse = await fetch(
                  `${process.env.OUTBOUND_CALL_URL || "https://c110-81-33-205-107.ngrok-free.app"}/call-status/${callSid}`
                );

                if (statusResponse.ok) {
                  const statusData = await statusResponse.json();

                  if (
                    statusData.status === "completed" ||
                    statusData.status === "failed" ||
                    statusData.status === "busy" ||
                    statusData.status === "no-answer" ||
                    statusData.status === "canceled"
                  ) {
                    callCompleted = true;
                    console.log(
                      "Call completed with status:",
                      statusData.status
                    );
                  }
                } else {
                  console.log(
                    "Error checking call status:",
                    statusResponse.status
                  );
                }
              } catch (error) {
                console.error(
                  "Network error checking call status:",
                  error instanceof Error ? error.message : String(error)
                );
              }

              // If we've been waiting for more than 30 seconds, assume the call is in progress
              // and show a message to the user
              if (waitedTime >= 30 && !callCompleted) {
                // Break out of the loop after 30 seconds regardless of call status
                console.log(
                  "Proceeding after 30 seconds regardless of call status"
                );
                callCompleted = true;
              }
            } catch (error) {
              console.error("Error in call status check loop:", error);

              // If any error occurs, don't keep the user waiting
              if (waitedTime > 30) {
                callCompleted = true;
              }
            }
          }
          // Update the order in Shopify
          await updateShippingAddress(
            shopifyData.order.admin_graphql_api_id,
            addressValidation.formattedAddress,
            shopifyData.order.shipping_address
          );

          // After call is completed or timeout, show confirmation message
          const confirmationMessage =
            language === "Spanish"
              ? `¡Perfecto! He actualizado la dirección de envío a:\n\n${addressValidation.formattedAddress}\n\n¡Tu pedido se enviará a esta nueva dirección! 📦✨`
              : `Perfect! I've updated the shipping address to:\n\n${addressValidation.formattedAddress}\n\nYour order will be shipped to this new address! 📦✨`;

          return confirmationMessage;
        }
      } catch (error) {
        console.error("Error making or monitoring outbound call:", error);

        // Return an error message to the user
        const errorMessage =
          language === "Spanish"
            ? "Lo siento, hubo un problema al realizar la llamada. Por favor, intenta más tarde."
            : "Sorry, there was a problem making the call. Please try again later.";

        return errorMessage;
      }
    }

    return await aiService.confirmDeliveryAddress(
      parameters,
      message,
      context,
      language
    );
  }
}

export async function handleUpdateOrder(
  parameters: ClassifiedMessage["parameters"],
  message: string,
  context: OpenAIMessage[],
  language: string
): Promise<string> {
  const { order_number, email, update_type } = parameters;

  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(language);
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
  context: OpenAIMessage[],
  language: string
): Promise<string> {
  const { product_name, height, fit } = parameters;
  const shopifyData = await extractProduct(product_name);

  // For size queries, we need both product data and size-related parameters
  if (shopifyData?.success && shopifyData?.product) {
    let product_type = "CREWNECK"; // default type

    // Type guard to ensure we have a valid product with title
    const product = shopifyData.product;
    if (
      typeof product === "object" &&
      product !== null &&
      "title" in product &&
      typeof product.title === "string"
    ) {
      const upperTitle = product.title.toUpperCase();
      if (upperTitle.includes("HOODIE")) {
        product_type = "HOODIE";
      } else if (upperTitle.includes("SWEATSHIRT")) {
        product_type = "SWEATSHIRT";
      } else if (upperTitle.includes("POLO")) {
        product_type = "POLO";
      }
    }
    // If asking about sizing, we need height and fit preference
    if (!product) {
      const promptMessage =
        language === "Spanish"
          ? `Para recomendarte la mejor talla, necesito saber el nombre del producto`
          : `To recommend the best size, I need to know the product name`;
      return promptMessage;
    }

    // If asking about sizing, we need height and fit preference
    const productTitle =
      shopifyData?.product && "title" in shopifyData.product
        ? shopifyData.product.title
        : "";
    if ((!height || !fit) && productTitle) {
      const promptMessage =
        language === "Spanish"
          ? `Para recomendarte la mejor talla para el ${productTitle}, necesito saber:\n${!height ? "- Tu altura (en cm)\n" : ""}${!fit ? "- Tu preferencia de ajuste (ajustado, regular, holgado)" : ""}`
          : `To recommend the best size for the ${productTitle}, I need to know:\n${!height ? "- Your height (in cm)\n" : ""}${!fit ? "- Your preferred fit (tight, regular, loose)" : ""}`;
      return promptMessage;
    }

    // Get the size chart for this product type
    const sizeChart = sizeCharts[product_type];
    if (!sizeChart) {
      return language === "Spanish"
        ? "Lo siento, no tengo información de tallas para este producto específico."
        : "Sorry, I don't have size information for this specific product.";
    }

    return await aiService.generateFinalAnswer(
      "product_sizing",
      parameters,
      shopifyData,
      message,
      context,
      language,
      JSON.stringify(sizeChart)
    );
  }

  // For non-sizing product inquiries or when product is not found
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
    "product_inquiry",
    parameters,
    shopifyData,
    message,
    context,
    language
  );
}
