import { NextResponse } from "next/server";
import { trackOrder } from "../queries/order";
import { updateTicketWithOrderInfo } from "../actions/tickets";
import { aiService } from "./ai";
import {
  handleChangeDelivery,
  handleDeliveryIssue,
  handleProductInquiry,
  handleUpdateOrder,
} from "./intent";
import { handleOrderTracking } from "./intent";

export async function POST(req: Request): Promise<Response> {
  try {
    // Rate limiting check could be added here
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { message, context, currentTicket } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate context if provided
    if (
      context &&
      (!Array.isArray(context) ||
        !context.every(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof item.role === "string" &&
            typeof item.content === "string"
        ))
    ) {
      return NextResponse.json(
        { error: "Context must be an array of {role, content} objects" },
        { status: 400 }
      );
    }

    const classification = await aiService.classifyMessage(message, context);
    const { intent, parameters, language } = classification;
    let updatedTicket = null;
    if (
      currentTicket?.id &&
      parameters.order_number &&
      parameters.email &&
      (!currentTicket.orderNumber || !currentTicket.email)
    ) {
      updatedTicket = await updateTicketWithOrderInfo(
        currentTicket.id,
        parameters.order_number,
        parameters.email
      );
    }
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

      case "update_order":
        console.log("Update order intent");
        response = await handleUpdateOrder(
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

      case "conversation_end":
        console.log("Conversation end intent");
        response = await aiService.generateFinalAnswer(
          intent,
          parameters,
          null,
          message,
          context,
          language
        );
        break;

      case "other-general":

      default:
        console.log("Other general intent or default case");
        response = await aiService.generateFinalAnswer(
          intent,
          parameters,
          null,
          message,
          context,
          language
        );
    }

    return NextResponse.json({ response, updatedTicket });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "An error occurred processing your request." },
      { status: 500 }
    );
  }
}
