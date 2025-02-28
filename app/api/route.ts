import { NextResponse } from "next/server";
import {
  extractProduct,
  trackOrder,
  updateShippingAddress,
} from "../queries/order";
import {
  ChatMessage,
  ClassifiedMessage,
  Intent,
  ShopifyData,
  ShopifyDataTracking,
} from "@/types";
import { sendEmail } from "./mail";
import { extractCompleteOrder } from "../queries/order";

// AI Service for message classification and response generation
class AIService {
  private readonly apiKey: string;
  private readonly googleMapsApiKey: string;
  private readonly SYSTEM_PROMPTS = {
    CLASSIFICATION: `You are an intelligent assistant that classifies user messages for a Shopify ecommerce chatbot. Your task is to identify the user's intent and extract relevant parameters.

Consider both user messages and system responses in the conversation context when classifying. For example:
- If a user first tracks an order and receives a response saying it's delivered, then mentions they haven't received it, classify it as a delivery_issue
- If the system previously provided tracking info and the user reports issues, maintain that tracking number in the parameters
- If the system confirmed an order number/email pair in a previous response, maintain those in subsequent classifications
- For change_delivery intent, set delivery_address_confirmed to true ONLY if the user explicitly confirms the new address that was proposed by the system in a previous message. The confirmation should be in response to a system message that proposed a specific address.
- For returns_exchange intent, check if the returns website URL was already provided in previous system messages
- If user asks about returns or exchange policy, classify it as returns_exchange intent
- If user asks about changing the size of a product from their order, classify it as returns_exchange intent
- If user asks about product sizes or sizing information, classify it as product_sizing intent
- If the user says "thank you", "thanks", "gracias", "ok", "perfect", "perfecto" or similar closing remarks without asking anything else, classify it as "conversation_end"
- For queries that don't match other intents but are about an order (shipping, delivery, order status, etc), classify as "other-order"
- For queries that don't match other intents and are not related to any order, classify as "other-general"

Output ONLY a JSON object with the following structure:
{
  "intent": one of ["order_tracking", "returns_exchange", "change_delivery", "return_status", "promo_code", "other-order", "other-general", "delivery_issue", "conversation_end", "product_sizing"],
  "parameters": {
    "order_number": "extracted order number or empty string",
    "email": "extracted email or empty string", 
    "product_handle": "extracted product handle or empty string",
    "new_delivery_info": "new delivery information or empty string",
    "delivery_status": "delivered but not received or empty string",
    "tracking_number": "tracking number from context or empty string",
    "delivery_address_confirmed": "true if user explicitly confirms system's proposed address, false otherwise",
    "return_type": "return or exchange or empty string",
    "returns_website_sent": "true if returns website URL was already sent, false otherwise",
    "product_name": "name of product being asked about or empty string",
    "size_query": "specific size question or empty string"
  },
  "language": "English" or "Spanish" (detect the language of the message)
}`,

    FINAL_ANSWER: `You are a friendly 30-year-old customer service rep named Santi. Your role is to assist customers with their inquiries about orders, products, returns, and other ecommerce related questions.

Important communication guidelines:
- Keep responses extremely brief but professional, using emojis when needed
- Use spanish from Spain(for Spanish responses)
- For follow-up messages (context array has items), do not include any introduction
- When asking for order number and email, provide example format in a casual way
- For order tracking responses:
  * Check shopifyData.fulfillments array
  * If empty array, order is still being prepared
  * If array has items, tracking info is available in the fulfillments
- For delivery issues, provide helpful suggestions in a friendly, empathetic way
- For address changes, check order status in shopifyData
- For returns/exchanges, explain the process casually and provide the returns portal link: https://shameless-returns-web.vercel.app
- For promo code inquiries, explain newsletter benefits in a fun way
- For product sizing inquiries:
  * Emphasize that garments are oversized/oversize fit
  * Recommend ordering usual size or one size down
  * Check product description for specific sizing details
  * Provide measurements if available in product data
- If the intent is "conversation_end", respond with a friendly closing message like "Thank you for trusting Shameless Collective!" in English or "¡Gracias por confiar en Shameless Collective!" in Spanish`,

    ADDRESS_CONFIRMATION: `You are a friendly 23-year-old customer service rep named Santi helping with address collection.

Important guidelines:
- Keep responses super casual and friendly
- Use emojis and informal language
- Consider previous conversation context
- For Spanish responses, use Spain-specific expressions and vosotros form
- For address confirmations, present the address casually and ask for confirmation
- For multiple addresses, number them and ask user to pick one
- When asking for a new address, remind them to include zip code, city and complete street address
- If no address is provided, ask for it in a friendly way`,
  };

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    if (!googleMapsApiKey) throw new Error("GOOGLE_MAPS_API_KEY is not set");

    this.apiKey = apiKey;
    this.googleMapsApiKey = googleMapsApiKey;
  }

  private async callOpenAI(messages: ChatMessage[], temperature = 0) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature,
        messages,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", await response.text());
      throw new Error("OpenAI API error");
    }

    return response.json();
  }

  private getDefaultClassification(): ClassifiedMessage {
    return {
      intent: "other-general",
      parameters: {
        order_number: "",
        email: "",
        product_handle: "",
        new_delivery_info: "",
        delivery_status: "",
        tracking_number: "",
        delivery_address_confirmed: false,
        return_type: "",
        returns_website_sent: false,
        product_name: "",
        size_query: "",
      },
      language: "English",
    };
  }

  async classifyMessage(
    message: string,
    context?: { role: string; content: string }[]
  ): Promise<ClassifiedMessage> {
    const messages = [
      { role: "system", content: this.SYSTEM_PROMPTS.CLASSIFICATION },
      ...(context || []),
      { role: "user", content: message },
    ];

    try {
      const data = await this.callOpenAI(messages);
      const classification = JSON.parse(data.choices[0].message.content);

      return this.enrichClassification(classification, context);
    } catch (error) {
      console.error("Error in message classification:", error);
      return this.getDefaultClassification();
    }
  }

  private enrichClassification(
    classification: ClassifiedMessage,
    context?: { role: string; content: string }[]
  ) {
    if (context?.length) {
      if (classification.intent === "other-general") {
        this.inheritPreviousIntent(classification, context);
      }

      if (classification.intent === "delivery_issue") {
        this.extractTrackingFromContext(classification, context);
      }

      if (classification.intent === "returns_exchange") {
        classification.parameters.returns_website_sent = context.some((msg) =>
          msg.content.includes("https://shameless-returns-web.vercel.app")
        );
      }
    }

    return classification;
  }

  private inheritPreviousIntent(
    classification: ClassifiedMessage,
    context: { role: string; content: string }[]
  ) {
    for (let i = context.length - 1; i >= 0; i--) {
      const msg = context[i];
      if (msg.role === "assistant" && msg.content.includes("intent")) {
        try {
          const prevClassification = JSON.parse(msg.content);
          if (
            prevClassification.intent &&
            prevClassification.intent !== "other-general"
          ) {
            classification.intent = prevClassification.intent;
            classification.parameters = {
              ...prevClassification.parameters,
              ...classification.parameters,
            };
            break;
          }
        } catch (e) {
          console.error("Error parsing previous classification:", e);
          continue;
        }
      }
    }
  }

  private extractTrackingFromContext(
    classification: ClassifiedMessage,
    context: { role: string; content: string }[]
  ) {
    const trackingRegex = /\[here\]\((https:\/\/.*?)\)/;
    for (const msg of context) {
      const match = msg.content.match(trackingRegex);
      if (match?.[1]) {
        const trackingNumber = match[1]
          .split("/")
          .find((part) => /^\d+$/.test(part));
        if (trackingNumber) {
          classification.parameters.tracking_number = trackingNumber;
          break;
        }
      }
    }
  }

  async generateFinalAnswer(
    intent: Intent,
    parameters: ClassifiedMessage["parameters"],
    shopifyData: ShopifyData | null | ShopifyDataTracking,
    userMessage: string,
    context?: { role: string; content: string }[],
    language?: string
  ): Promise<string> {
    // For conversation_end intent, return a nice closing message
    if (intent === "conversation_end") {
      return language === "Spanish"
        ? "¡Gracias por confiar en Shameless Collective! ¡Que tengas un buen día! 🙌✨"
        : "Thank you for trusting Shameless Collective! Have a great day! 🙌✨";
    }

    const systemPrompt = `${this.SYSTEM_PROMPTS.FINAL_ANSWER}

Based on the classified intent "${intent}" and the following data:
${JSON.stringify(parameters, null, 2)}

Additional Context:
${userMessage}
${context?.length ? `\n${context.map((msg) => msg.content).join("\n")}` : ""}
${
  shopifyData?.success && shopifyData?.order
    ? `\nOrder Details:\n${JSON.stringify(
        shopifyData.order,
        null,
        2
      )}\n\nTracking Status: ${
        Array.isArray(shopifyData.order)
          ? shopifyData.order[0]?.fulfillments?.length === 0
          : shopifyData.order?.fulfillments?.length === 0
          ? "Order is still being prepared"
          : "Tracking available in fulfillments array"
      }`
    : ""
}

${
  intent === "other-order"
    ? `IMPORTANT: Since this is an 'other-order' intent:
- Carefully analyze the conversation context to provide a relevant response
- If user asks about shipping address, check shopifyData.shipping_address object
- If user asks about billing address, check shopifyData.billing_address object
- If user asks about their personal information, check shopifyData.customer object
- Maintain continuity with any previous interactions`
    : "Provide a concise response that directly addresses the customer's needs. If you don't have enough information, briefly ask for the specific details needed."
}

IMPORTANT GUIDELINES:
- Do not include any introduction
- Do not use markdown formatting or smart bolding
- When sharing links, provide them directly (e.g., "https://example.com" instead of "[Click here](https://example.com)")
- If user asks about delivery times, inform them normal delivery time is 3-5 business days
- If user indicates waiting longer than 5 business days, inform them we will open a ticket to investigate
- Respond ONLY in ${language}`;

    try {
      const data = await this.callOpenAI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        0.8
      );

      return data.choices[0].message.content;
    } catch (error) {
      console.error("Error generating final answer:", error);
      return "Sorry, an error occurred while generating a response.";
    }
  }

  async confirmDeliveryAddress(
    parameters: ClassifiedMessage["parameters"],
    userMessage: string,
    context?: { role: string; content: string }[],
    language?: string
  ): Promise<string> {
    const { new_delivery_info } = parameters;

    if (!new_delivery_info) {
      return language === "Spanish"
        ? "¿Me puedes dar la nueva dirección de entrega? Recuerda incluir el código postal, ciudad y dirección completa 📦"
        : "Can you give me the new delivery address? Remember to include the zip code, city and complete address 📦";
    }

    const addressValidation = await this.validateAddress(new_delivery_info);

    if (!addressValidation.formattedAddress) {
      return language === "Spanish"
        ? "Lo siento, no pude validar esa dirección. ¿Podrías proporcionarme la dirección completa incluyendo código postal y ciudad? 🏠"
        : "Sorry, I couldn't validate that address. Could you provide me with the complete address including zip code and city? 🏠";
    }

    const systemPrompt = `${this.SYSTEM_PROMPTS.ADDRESS_CONFIRMATION}

Previous conversation context:
${
  context?.length
    ? context.map((msg) => `${msg.role}: ${msg.content}`).join("\n")
    : "No previous context"
}

Include in the response the following:
${
  addressValidation.multipleCandidates
    ? language === "Spanish"
      ? `He encontrado varias direcciones posibles. Por favor, elige el número de la dirección correcta o proporciona una nueva:\n\n${addressValidation.addressCandidates
          .map((addr: string, i: number) => `${i + 1}. ${addr}`)
          .join("\n")}`
      : `I found multiple possible addresses. Please choose the number of the correct address or provide a new one:\n\n${addressValidation.addressCandidates
          .map((addr: string, i: number) => `${i + 1}. ${addr}`)
          .join("\n")}`
    : language === "Spanish"
    ? `¿Es esta la dirección correcta?\n\n${addressValidation.formattedAddress}\n\nPor favor, responde "sí" para confirmar o proporciona la dirección correcta si no lo es 😊`
    : `Is this the right address?\n\n${addressValidation.formattedAddress}\n\nPlease reply "yes" to confirm or provide the correct address if it's not 😊`
}

IMPORTANT: Respond ONLY in ${language}`;

    try {
      const data = await this.callOpenAI(
        [
          { role: "system", content: systemPrompt },
          ...(context || []),
          { role: "user", content: userMessage },
        ],
        0.8
      );

      return data.choices[0].message.content;
    } catch (error) {
      console.error("Error confirming delivery address:", error);
      return "Sorry, an error occurred while processing your address.";
    }
  }

  async validateAddress(address: string) {
    try {
      interface PlaceCandidate {
        formatted_address: string;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
          address
        )}&inputtype=textquery&fields=formatted_address&key=${
          this.googleMapsApiKey
        }`
      );

      if (!response.ok) {
        throw new Error("Failed to validate address with Google API");
      }

      const data = await response.json();
      return {
        formattedAddress: data.candidates?.[0]?.formatted_address || "",
        multipleCandidates: data.candidates?.length > 1 || false,
        addressCandidates:
          data.candidates?.map((c: PlaceCandidate) => c.formatted_address) ||
          [],
      };
    } catch (error) {
      console.error("Error validating address:", error);
      return {
        formattedAddress: "",
        multipleCandidates: false,
        addressCandidates: [],
      };
    }
  }
}

// Main API handler
const aiService = new AIService();

export async function POST(req: Request): Promise<Response> {
  try {
    const { message, context } = await req.json();

    if (!message) {
      return NextResponse.json(
        { response: "No message provided." },
        { status: 400 }
      );
    }

    const classification = await aiService.classifyMessage(message, context);
    const { intent, parameters, language } = classification;

    console.log("Message classification:", { intent, parameters, language });

    let response: string;

    // Process intent
    switch (intent) {
      case "order_tracking":
        console.log("Order tracking intent");
        response = await handleOrderTracking(parameters, context, language);
        break;

      case "returns_exchange":
        console.log("Returns exchange intent");
        response =
          language === "Spanish"
            ? "¡Claro! Puedes hacer el cambio o devolución en el siguiente link: https://shameless-returns-web.vercel.app"
            : "Sure thing! You can make the change or return in the following link: https://shameless-returns-web.vercel.app";
        break;

      case "delivery_issue":
        console.log("Delivery issue intent");
        response = await handleDeliveryIssue(
          parameters,
          message,
          context,
          language
        );
        break;

      case "change_delivery":
        console.log("Change delivery intent");
        response = await handleChangeDelivery(
          parameters,
          message,
          context,
          language
        );
        break;

      case "product_sizing":
        console.log("Product sizing intent");
        response = await handleProductInquiry(
          parameters,
          message,
          context,
          language
        );
        break;

      case "other-order":
        console.log("Other order-related intent");
        if (!parameters.order_number || !parameters.email) {
          response =
            language === "Spanish"
              ? "Para ayudarte mejor con tu consulta sobre el pedido, necesito el número de pedido (tipo #12345) y tu email 😊"
              : "To better help you with your order-related query, I need your order number (like #12345) and email 😊";
        } else {
          const orderData = await trackOrder(
            parameters.order_number,
            parameters.email
          );
          console.log("Order data:", orderData);
          response = await aiService.generateFinalAnswer(
            intent,
            parameters,
            orderData,
            message,
            context,
            language
          );
        }
        break;

      case "other-general":
        console.log("Other general intent");
        response = await aiService.generateFinalAnswer(
          intent,
          parameters,
          null,
          message,
          context,
          language
        );
        break;

      default:
        response = await aiService.generateFinalAnswer(
          intent,
          parameters,
          null,
          message,
          context,
          language
        );
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { response: "An error occurred processing your request." },
      { status: 500 }
    );
  }
}

async function handleOrderTracking(
  parameters: ClassifiedMessage["parameters"],
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { order_number, email } = parameters;

  if (!order_number || !email) {
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

  const shopifyData = await trackOrder(order_number, email);
  if (!shopifyData.success) {
    if (shopifyData.error === "InvalidOrderNumber") {
      const prompt =
        language === "Spanish"
          ? "¡Vaya! No encuentro ningún pedido con ese número 😅 ¿Puedes revisarlo y volver a intentarlo?"
          : "Oops! Can't find any order with that number 😅 Can you check and try again?";
      return await aiService.generateFinalAnswer(
        "order_tracking",
        parameters,
        null,
        prompt,
        context,
        language
      );
    }

    if (shopifyData.error === "EmailMismatch") {
      const prompt =
        language === "Spanish"
          ? "¡Ups! El email no coincide con el del pedido 🤔 ¿Puedes revisar si es el correcto?"
          : "Oops! The email doesn't match the order 🤔 Can you check if it's the right one?";
      return await aiService.generateFinalAnswer(
        "order_tracking",
        parameters,
        null,
        prompt,
        context,
        language
      );
    }
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

async function handleDeliveryIssue(
  parameters: ClassifiedMessage["parameters"],
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  try {
    await sendEmail(
      "hello@shamelesscollective.com",
      parameters.order_number,
      parameters.email
    );
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

async function handleChangeDelivery(
  parameters: ClassifiedMessage["parameters"],
  message: string,
  context: ChatMessage[],
  language: string
): Promise<string> {
  const { order_number, email, new_delivery_info, delivery_address_confirmed } =
    parameters;

  if (!order_number || !email) {
    const prompt =
      language === "Spanish"
        ? "¡Ey! Necesito el número de pedido (tipo #12345) y tu email para poder ayudarte con el cambio de dirección 📦"
        : "Hey! I need your order number (like #12345) and email to help you with the address change 📦";

    return await aiService.generateFinalAnswer(
      "change_delivery",
      parameters,
      null,
      prompt,
      context,
      language
    );
  }

  const shopifyData = await extractCompleteOrder(order_number, email);

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

async function handleProductInquiry(
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
