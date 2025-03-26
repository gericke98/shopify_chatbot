import { NextResponse } from "next/server";
import { createHmac } from "crypto";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!shop || !code || !state) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Verify the request is from Shopify
    const hmac = searchParams.get("hmac");
    if (!hmac) {
      return NextResponse.json({ error: "Missing HMAC" }, { status: 400 });
    }

    // Create the verification string
    const params = new URLSearchParams(searchParams);
    params.delete("hmac");
    const verificationString = params.toString();

    // Calculate HMAC
    const calculatedHmac = createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
      .update(verificationString)
      .digest("hex");

    if (calculatedHmac !== hmac) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    // Exchange the authorization code for an access token
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to get access token");
    }

    const { access_token } = await tokenResponse.json();

    // Store the access token securely (you should implement this)
    // await storeAccessToken(shop, access_token);

    // Redirect to the app's main page
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
