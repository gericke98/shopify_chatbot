import {
  extractCompleteOrder,
  extractProduct,
  insertCustomer,
  createPromoCode,
  trackOrder,
  updateShippingAddress,
} from "../queries/order";
import { aiService } from "./ai";
import { sendEmail } from "./mail";
import { MessageParameters } from "@/app/types/api";
import { SizeChart, ChatMessage, InvoiceData } from "@/types";
import { jsPDF } from "jspdf";

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
  language: string,
  error?: string
): Promise<string> {
  let prompt = "";
  console.log("error", error);
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
  return prompt;
}

export async function handleOrderTracking(
  parameters: MessageParameters,
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { order_number, email } = parameters;

  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(language);
  }

  const shopifyData = await trackOrder(order_number, email);
  if (!shopifyData.success) {
    return await InvalidCredentials(language, shopifyData.error);
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
  parameters: MessageParameters,
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  try {
    const { order_number, email } = parameters;
    if (!order_number || !email) {
      return await NoOrderNumberOrEmail(language);
    }
    const shopifyData = await trackOrder(order_number, email);
    if (!shopifyData.success) {
      return await InvalidCredentials(language, shopifyData.error);
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
  parameters: MessageParameters,
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { order_number, email, new_delivery_info, delivery_address_confirmed } =
    parameters;

  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(language);
  }

  const shopifyData = await extractCompleteOrder(order_number, email);
  if (!shopifyData.success) {
    return await InvalidCredentials(language, shopifyData.error);
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
    // Order not yet shipped
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
        {
          first_name: shopifyData.order.shipping_address.first_name || "",
          last_name: shopifyData.order.shipping_address.last_name || "",
          phone: shopifyData.order.shipping_address.phone || "",
        }
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

  // Order already shipped
  if (!new_delivery_info) {
    return await aiService.confirmDeliveryAddress(
      parameters,
      message,
      context,
      language
    );
  }

  const addressValidation = await aiService.validateAddress(new_delivery_info);
  if (!addressValidation.formattedAddress) {
    return await aiService.confirmDeliveryAddress(
      parameters,
      message,
      context,
      language
    );
  }

  if (delivery_address_confirmed) {
    try {
      const phoneNumber = "+34608667749";

      if (phoneNumber) {
        const callPrompt = `Eres una persona llamada Silvia. Estás llamando a una empresa de envíos para modificar la dirección de envío de tu paquete. Responde en 3 a 7 oraciones en la mayoría de los casos.
              Si te pregunta, aquí tienes información adicional sobre el pedido: 
              - Número de seguimiento ${shopifyData.order.fulfillments[0].tracking_number}
              - Nueva dirección de entrega: ${addressValidation.formattedAddress}
              Actúa como el cliente y no como un agente, es decir, la persona a la que llamas te tiene que dar la solución, tú no le tienes que ayudar en resolver sus problemas.`;

        const firstMessage =
          language === "Spanish"
            ? `Hola, soy Silvia. Llamo para cambiar la dirección de envío de mi pedido`
            : `Hello, this is Silvia. I'm calling to change the delivery address of my order.`;

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
        let callCompleted = false;
        const maxWaitTime = 300;
        let waitedTime = 0;

        while (!callCompleted && waitedTime < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          waitedTime += 5;

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
              }
            }

            if (waitedTime >= 30 && !callCompleted) {
              callCompleted = true;
            }
          } catch (error) {
            console.error("Error in call status check loop:", error);
            if (waitedTime > 30) {
              callCompleted = true;
            }
          }
        }

        await updateShippingAddress(
          shopifyData.order.admin_graphql_api_id,
          addressValidation.formattedAddress,
          {
            first_name: shopifyData.order.shipping_address.first_name || "",
            last_name: shopifyData.order.shipping_address.last_name || "",
            phone: shopifyData.order.shipping_address.phone || "",
          }
        );

        const confirmationMessage =
          language === "Spanish"
            ? `¡Perfecto! He actualizado la dirección de envío a:\n\n${addressValidation.formattedAddress}\n\n¡Tu pedido se enviará a esta nueva dirección! 📦✨`
            : `Perfect! I've updated the shipping address to:\n\n${addressValidation.formattedAddress}\n\nYour order will be shipped to this new address! 📦✨`;

        return confirmationMessage;
      }
    } catch (error) {
      console.error("Error making or monitoring outbound call:", error);
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

export async function handleUpdateOrder(
  parameters: MessageParameters,
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { order_number, email, update_type } = parameters;

  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(language);
  }

  const shopifyData = await extractCompleteOrder(order_number, email);
  if (!shopifyData.success) {
    return await InvalidCredentials(language, shopifyData.error);
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
  parameters: Partial<MessageParameters>,
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { product_name, height, fit } = parameters;

  // First check if we have a product name
  if (!product_name) {
    return language === "Spanish"
      ? "¿Sobre qué producto te gustaría saber la talla?"
      : "Which product would you like to know the size for?";
  }

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
    const productTitle =
      shopifyData?.product && "title" in shopifyData.product
        ? shopifyData.product.title
        : "";
    if (!height || !fit) {
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

    const validatedParams: MessageParameters = {
      order_number: "",
      email: "",
      product_handle: "",
      new_delivery_info: "",
      delivery_status: "",
      tracking_number: "",
      delivery_address_confirmed: false,
      return_type: "",
      return_reason: "",
      returns_website_sent: false,
      product_type: "",
      product_name: (productTitle || product_name || "") as string,
      product_size: "",
      fit: "",
      size_query: "",
      update_type: "",
      height: "",
      weight: "",
      usual_size: "",
      ...parameters,
    };

    return await aiService.generateFinalAnswer(
      "product_sizing",
      validatedParams,
      shopifyData,
      message,
      context,
      language,
      JSON.stringify(sizeChart)
    );
  }

  return language === "Spanish"
    ? "Lo siento, no pude encontrar ese producto. ¿Podrías verificar el nombre?"
    : "Sorry, I couldn't find that product. Could you verify the name?";
}

export async function handleProductInquiryRestock(
  parameters: Partial<MessageParameters>,
  language: string
): Promise<string> {
  const { product_name, email, product_size } = parameters;
  const requestedSize = product_size?.toUpperCase() || "";
  console.log("parameters", parameters);
  // First check if we have a product name
  if (!product_name) {
    return language === "Spanish"
      ? "¿Qué producto te gustaría saber cuándo estará disponible?"
      : "Which product would you like to know about restocking?";
  }
  if (product_name == "not_found") {
    return language === "Spanish"
      ? `Lo siento, no pude encontrar el producto. ¿Podrías confirmar el nombre exacto del producto? Por ejemplo: "Without shame crewnweck"`
      : `I'm sorry, I couldn't find the product. Could you confirm the exact product name? For example: "Without shame crewnweck"`;
  }
  if (!requestedSize) {
    return language === "Spanish"
      ? "¿Qué talla te gustaría saber cuándo estará disponible?"
      : "Which size would you like to know about restocking?";
  }
  if (product_size == "not_found") {
    return language === "Spanish"
      ? `Lo siento, no pude encontrar la talla indicada. ¿Podrías confirmar la talla exacta del producto? Por ejemplo: "Talla S"`
      : `I'm sorry, I couldn't find the size you mentioned. Could you confirm the exact size of the product? For example: "Small"`;
  }
  // Second check if we have stock of the product
  const shopifyData = await extractProduct(product_name);

  if (!shopifyData || !shopifyData.product) {
    return language === "Spanish"
      ? `Lo siento, no pude encontrar el producto "${product_name}". ¿Podrías confirmar el nombre exacto del producto? Por ejemplo: "Without shame crewnweck"`
      : `I'm sorry, I couldn't find the product "${product_name}". Could you confirm the exact product name? For example: "Without shame crewnweck"`;
  }

  const productData = shopifyData.product as {
    variants?: Array<{ id: string; title: string; inventory_quantity: number }>;
  };
  const productHandle = shopifyData.product?.handle;
  const matchingVariant = productData.variants?.find(
    (variant) => variant.title.toUpperCase() === requestedSize
  );

  if (!matchingVariant) {
    return language === "Spanish"
      ? "Lo siento, no encontré esa talla específica para este producto."
      : "Sorry, I couldn't find that specific size for this product.";
  }

  if (matchingVariant.inventory_quantity > 0 && productHandle) {
    const link = `https://shamelesscollective.com/products/${productHandle}?variant=${matchingVariant.id}`;
    return language === "Spanish"
      ? `¡Buenas noticias! Esta talla está disponible! Consigue la tuya aquí: ${link}`
      : `Good news! This size is available! Get it here: ${link}`;
  }

  // Third check if we have an email
  if (!email || typeof email !== "string") {
    return language === "Spanish"
      ? "¡Perfecto! Si me dejas tu email te avisaré cuando el producto esté disponible 😊"
      : "Perfect! If you share your email with me, I'll notify you when the product is back in stock 😊";
  }

  const productTitle: string =
    shopifyData?.product &&
    typeof shopifyData.product === "object" &&
    shopifyData.product !== null &&
    "title" in shopifyData.product &&
    typeof shopifyData.product.title === "string"
      ? shopifyData.product.title
      : "";
  // For restock queries, we need product data
  if (
    shopifyData?.success &&
    shopifyData?.product &&
    productTitle &&
    typeof email === "string"
  ) {
    // Create customer
    const response = await insertCustomer(email, productTitle);
    if (response.success) {
      return language === "Spanish"
        ? `¡Perfecto! Te avisaremos en ${email} cuando el ${productTitle} esté disponible 😊`
        : `Perfect! We'll notify you at ${email} when the ${productTitle} is back in stock 😊`;
    } else {
      if (response.error == "Email has already been taken") {
        return language === "Spanish"
          ? `Vaya! Parece que ese email ya lo tenemos registrado. ¿Podrías intentarlo con otro?`
          : `Oops! It seems that email is already registered. Could you try with another one?`;
      }
      console.error("Error creating customer:", response.error);
      return language === "Spanish"
        ? "Lo siento, ha ocurrido un error al registrar tu correo. ¿Podrías intentarlo de nuevo?"
        : "I'm sorry, there was an error registering your email. Could you please try again?";
    }
  }

  return language === "Spanish"
    ? "Lo siento, no pude encontrar ese producto. ¿Podrías verificar el nombre?"
    : "Sorry, I couldn't find that product. Could you verify the name?";
}

export async function handlePromoCode(
  parameters: Partial<MessageParameters>,
  language: string
): Promise<string> {
  const { email } = parameters;
  console.log("parameters", parameters);
  if (!email || typeof email !== "string") {
    return language === "Spanish"
      ? "Vamos a hacer una cosa, si me dejas tu email te crearé un descuento del 20% que podrás usar durante los próximos 15 minutos😊"
      : "Perfect! If you share your email with me, I'll notify you when the product is back in stock 😊";
  }
  // Create customer
  const response = await insertCustomer(email);
  if (response.error == "Email has already been taken") {
    return language === "Spanish"
      ? `Vaya! Parece que ese email ya lo tenemos registrado. ¿Podrías intentarlo con otro?`
      : `Oops! It seems that email is already registered. Could you try with another one?`;
  }
  console.log("response customer", response);
  if (response.success) {
    const promoCode = await createPromoCode();
    console.log("promoCode", promoCode);
    if (promoCode.success) {
      return language === "Spanish"
        ? `Aquí tienes tu descuento del 20%: ${promoCode.code}. No se lo digas a nadie! Caduca en 15 minutos por lo que aprovéchalo!`
        : `Here's your 20% discount code: ${promoCode.code}. Don't tell anyone! It expires in 15 minutes so take advantage of it!`;
    } else {
      return language === "Spanish"
        ? "Lo siento, ha ocurrido un error al crear el descuento. ¿Podrías intentarlo de nuevo?"
        : "I'm sorry, there was an error creating the discount. Could you please try again?";
    }
  }
  return language === "Spanish"
    ? "Lo siento, ha ocurrido un error al crear el descuento. ¿Podrías intentarlo de nuevo?"
    : "I'm sorry, there was an error creating the discount. Could you please try again?";
}

const generateInvoice = async (data: InvoiceData): Promise<Buffer> => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Set initial position and margins
  let y = 20;
  let y1 = y;
  const leftMargin = 20;
  const centerMargin = 105;
  const rightMargin = 190;
  const lineHeight = 6;

  // Title
  doc.setFontSize(16);
  doc.text("FACTURA", rightMargin, y, { align: "right" });
  y += lineHeight * 2;
  doc.text(data.invoiceNumber, rightMargin, y, { align: "right" });
  y += lineHeight;
  doc.text(data.date, rightMargin, y, { align: "right" });

  y += lineHeight * 3;
  y1 = y;
  // Client data
  doc.setFontSize(12);
  doc.text("Datos del cliente", leftMargin, y);
  y += lineHeight * 2;
  doc.setFontSize(10);
  doc.text(data.name, leftMargin, y);
  y += lineHeight;
  doc.text(data.direccion, leftMargin, y);
  y += lineHeight;
  doc.text(data.auxiliarAddress, leftMargin, y);
  if (data.phone) {
    y += lineHeight;
    doc.text(data.phone, leftMargin, y);
  }

  // Company data
  doc.setFontSize(12);
  doc.text("Datos", rightMargin, y1, { align: "right" });
  y1 += lineHeight * 2;
  doc.setFontSize(10);
  doc.text("CORISA TEXTIL S.L.", rightMargin, y1, { align: "right" });
  y1 += lineHeight;
  doc.text("B02852895", rightMargin, y1, { align: "right" });
  y1 += lineHeight;
  doc.text("Calle Neptuno 29", rightMargin, y1, { align: "right" });
  y1 += lineHeight;
  doc.text("Pozuelo de Alarcón, Madrid, 28224", rightMargin, y1, {
    align: "right",
  });
  y1 += lineHeight;
  doc.text("(+34) 608667749", rightMargin, y1, { align: "right" });

  // Table headers
  y = y1 + 50;
  doc.setFontSize(12);
  doc.text("ARTÍCULOS", leftMargin, y);
  doc.text("CANTIDAD", centerMargin - 20, y);
  doc.text("PRECIO", centerMargin + 20, y);
  doc.text("TOTAL", rightMargin, y, { align: "right" });

  // Draw table lines
  doc.setLineWidth(0.5);
  doc.line(leftMargin, y - 5, rightMargin, y - 5);
  doc.line(leftMargin, y + 5, rightMargin, y + 5);

  // Order items
  y += lineHeight * 2;
  let subtotal = 0;
  data.pedidoList.forEach((item) => {
    doc.setFontSize(10);
    doc.text(item.name, leftMargin, y);
    doc.text(item.quantity, centerMargin - 20, y);
    doc.text(item.price, centerMargin + 20, y);
    doc.text(item.total, rightMargin, y, { align: "right" });

    subtotal += parseFloat(item.total.slice(0, -2));
    y += lineHeight * 1.5;
  });

  // Totals calculation
  const subtotalBase = data.subtotalInput / 1.21;
  subtotal = Math.round(subtotalBase * 100) / 100;
  const iva = data.ivaBool ? Math.round(0.21 * subtotal * 100) / 100 : 0;
  const total = subtotal + iva;

  // Footer totals
  y += lineHeight;
  doc.setFontSize(12);
  doc.text("Subtotal", centerMargin + 20, y);
  doc.text(`${subtotal} €`, rightMargin, y, { align: "right" });
  y += lineHeight * 2;
  doc.text("IVA", centerMargin + 20, y);
  doc.text(`${iva} €`, rightMargin, y, { align: "right" });
  y += lineHeight * 2;
  doc.text("TOTAL", centerMargin + 20, y);
  doc.text(`${total} €`, rightMargin, y, { align: "right" });

  // Get the PDF as a buffer
  return Buffer.from(doc.output("arraybuffer"));
};

export async function handleInvoiceRequest(
  parameters: Partial<MessageParameters>,
  language: string
): Promise<string> {
  const { order_number, email } = parameters;
  if (!order_number || !email) {
    return await NoOrderNumberOrEmail(language);
  }

  const shopifyData = await extractCompleteOrder(order_number, email);
  if (!shopifyData.success) {
    return await InvalidCredentials(language, shopifyData.error);
  }

  if (shopifyData.order) {
    const { billing_address, line_items, total_price, created_at } =
      shopifyData.order;

    // Prepare invoice data
    const invoiceData: InvoiceData = {
      name: `${billing_address.name}`,
      direccion: billing_address.address1,
      auxiliarAddress: `${billing_address.city}, ${billing_address.province}, ${billing_address.zip}`,
      phone: billing_address.phone || null,
      invoiceNumber: order_number,
      date: new Date(created_at).toLocaleDateString(),
      pedidoList: line_items.map((item) => ({
        name: item.title,
        quantity: item.quantity.toString(),
        price: `${item.price} €`,
        total: `${(parseFloat(item.price) * item.quantity).toFixed(2)} €`,
      })),
      ivaBool: true,
      subtotalInput: parseFloat(total_price),
    };

    try {
      const pdfBuffer = await generateInvoice(invoiceData);
      // Here you would call your email function with the PDF buffer
      await sendEmail(
        email,
        invoiceData.invoiceNumber,
        "Please find your invoice attached",
        pdfBuffer
      );

      return language === "Spanish"
        ? "¡Perfecto! Te he enviado la factura por email 📧"
        : "Perfect! I've sent the invoice to your email 📧";
    } catch (error) {
      console.error("Error generating invoice:", error);
      return language === "Spanish"
        ? "Lo siento, ha habido un error generando la factura. Por favor, inténtalo de nuevo más tarde."
        : "Sorry, there was an error generating the invoice. Please try again later.";
    }
  }

  return language === "Spanish"
    ? "Lo siento, no he podido encontrar los datos del pedido."
    : "Sorry, I couldn't find the order data.";
}
