import { NextResponse } from "next/server";
import { trackOrder } from "../queries/order";
import { updateTicketWithOrderInfo } from "../actions/tickets";
import { aiService } from "./ai";
import { NextRequest } from "next/server";
import { getMessages } from "@/app/actions/tickets";
import {
  handleChangeDelivery,
  handleDeliveryIssue,
  handleProductInquiry,
  handleUpdateOrder,
  InvalidCredentials,
  NoOrderNumberOrEmail,
} from "./intent";
import { handleOrderTracking } from "./intent";
import { handleError, APIError, createRequestId } from "./utils/error-handler";
import {
  ClassifiedMessage,
  Intent,
  MessageParameters,
  APIResponse,
} from "@/app/types/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Maximum duration allowed for Vercel hobby plan

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const ticketId = request.nextUrl.searchParams.get("ticketId");

    if (!ticketId) {
      throw new APIError(
        "Missing ticketId parameter",
        400,
        "MISSING_PARAMETER"
      );
    }

    const messages = await getMessages(ticketId);
    return NextResponse.json<APIResponse>({
      data: { messages },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, requestId);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = createRequestId();

  try {
    // Validate content type
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new APIError(
        "Content-Type must be application/json",
        415,
        "INVALID_CONTENT_TYPE"
      );
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error("Error parsing request body:", error);
      throw new APIError("Invalid JSON in request body", 400, "INVALID_JSON");
    }

    const { message, context, currentTicket } = body;

    // Validate required fields
    if (!message || typeof message !== "string") {
      throw new APIError(
        "Message must be a non-empty string",
        400,
        "INVALID_MESSAGE"
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
      throw new APIError("Invalid context format", 400, "INVALID_CONTEXT");
    }

    // Message classification with timeout
    const classificationPromise = aiService.classifyMessage(message, context);
    const classification = (await Promise.race([
      classificationPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new APIError(
                "Classification timeout",
                408,
                "CLASSIFICATION_TIMEOUT"
              )
            ),
          30000
        )
      ),
    ])) as ClassifiedMessage;

    const { intent, parameters, language } = classification;

    // Handle ticket updates
    let updatedTicket = null;
    if (
      currentTicket?.id &&
      parameters.order_number &&
      parameters.email &&
      (!currentTicket.orderNumber || !currentTicket.email)
    ) {
      if (!parameters.order_number || !parameters.email) {
        return NextResponse.json<APIResponse>({
          data: { response: await NoOrderNumberOrEmail(language) },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const shopifyData = await trackOrder(
        parameters.order_number,
        parameters.email
      );

      if (!shopifyData.success) {
        return NextResponse.json<APIResponse>({
          data: {
            response: await InvalidCredentials(language, shopifyData.error),
          },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      updatedTicket = await updateTicketWithOrderInfo(
        currentTicket.id,
        parameters.order_number,
        parameters.email,
        shopifyData.order?.customer
      );
    }

    // Process intent with timeout
    const intentHandler = async (
      intent: Intent,
      parameters: MessageParameters
    ) => {
      switch (intent) {
        case "order_tracking":
          return handleOrderTracking(parameters, context, language);
        case "returns_exchange":
          return language === "Spanish"
            ? "¡Claro! Puedes hacer el cambio o devolución en el siguiente link: https://shameless-returns-web.vercel.app"
            : "Sure thing! You can make the change or return in the following link: https://shameless-returns-web.vercel.app";
        case "delivery_issue":
          return handleDeliveryIssue(parameters, message, context, language);
        case "change_delivery":
          return handleChangeDelivery(parameters, message, context, language);
        case "product_sizing":
          return handleProductInquiry(parameters, message, context, language);
        case "update_order":
          return handleUpdateOrder(parameters, message, context, language);
        case "other-order":
          if (!parameters.order_number || !parameters.email) {
            return language === "Spanish"
              ? "Para ayudarte mejor con tu consulta sobre el pedido, necesito el número de pedido (tipo #12345) y tu email 😊"
              : "To better help you with your order-related query, I need your order number (like #12345) and email 😊";
          }
          const orderData = await trackOrder(
            parameters.order_number,
            parameters.email
          );
          return aiService.generateFinalAnswer(
            intent,
            parameters,
            orderData,
            message,
            context,
            language
          );
        default:
          return aiService.generateFinalAnswer(
            intent,
            parameters,
            null,
            message,
            context,
            language
          );
      }
    };

    const response = await Promise.race([
      intentHandler(intent, parameters),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new APIError(
                "Response generation timeout",
                408,
                "RESPONSE_TIMEOUT"
              )
            ),
          30000
        )
      ),
    ]);

    return NextResponse.json<APIResponse>({
      data: { response, updatedTicket },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, requestId);
  }
}
