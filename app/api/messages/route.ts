import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getMessages } from "@/app/actions/tickets";

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
