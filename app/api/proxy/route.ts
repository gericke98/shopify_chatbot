import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");
    const signature = searchParams.get("signature");

    if (!shop || !signature) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Verify the request is from Shopify
    const params = new URLSearchParams(searchParams);
    params.delete("signature");
    const verificationString = params.toString();

    const calculatedSignature = createHmac(
      "sha256",
      process.env.SHOPIFY_API_SECRET!
    )
      .update(verificationString)
      .digest("hex");

    if (calculatedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Handle the proxy request
    // This is where you'll implement your app proxy logic
    return NextResponse.json({
      message: "Proxy request received",
      shop,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Proxy request failed" },
      { status: 500 }
    );
  }
}
