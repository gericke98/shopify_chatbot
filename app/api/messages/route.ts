import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getMessages } from "@/app/actions/tickets";
import db from "@/db/drizzle";
import { messages } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ticketId = request.nextUrl.searchParams.get("ticketId");

  if (!ticketId) {
    return NextResponse.json(
      { error: "Missing ticketId parameter" },
      { status: 400 }
    );
  }

  try {
    const messages = await getMessages(ticketId);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ticketId, message } = await request.json();

    if (!ticketId || !message) {
      return NextResponse.json(
        { error: "Missing ticketId or message" },
        { status: 400 }
      );
    }

    await db.insert(messages).values({
      sender: message.sender,
      text: message.text,
      timestamp: new Date().toISOString(),
      ticketId: ticketId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding message:", error);
    return NextResponse.json(
      { error: "Failed to add message" },
      { status: 500 }
    );
  }
}
