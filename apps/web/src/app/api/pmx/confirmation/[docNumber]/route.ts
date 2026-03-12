import { NextRequest, NextResponse } from "next/server";
import { pmxLogin, type PmxConfig } from "@foundation/integrations";

function getPmxConfig(): PmxConfig {
  return {
    pmxHost: process.env.PMX_API_HOST || "pmxapi.stonex.com",
    pmxLoginUsername: process.env.PMX_LOGIN_USERNAME || "",
    pmxLoginPassword: process.env.PMX_LOGIN_PASSWORD || "",
    pmxLoginLocation: process.env.PMX_LOGIN_LOCATION || "LD",
    pmxPlatform: process.env.PMX_PLATFORM || "Desktop",
    pmxAccOptKey: process.env.PMX_ACC_OPT_KEY || "MT0601",
    pmxCreatedBy: process.env.PMX_CREATED_BY || "2",
    stonexHost: process.env.STONEX_HOST || "api.stonex.com",
    stonexSubscriptionKey: process.env.STONEX_SUBSCRIPTION_KEY || "",
    stonexUsername: process.env.STONEX_USERNAME || "",
    stonexPassword: process.env.STONEX_PASSWORD || "",
  };
}

/**
 * GET /api/pmx/confirmation/[docNumber]
 *
 * Proxies a trade confirmation PDF from the PMX API.
 * Authenticates with PMX, fetches the confirmation document,
 * and streams it back to the client.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docNumber: string }> },
) {
  try {
    const { docNumber } = await params;
    const decoded = decodeURIComponent(docNumber);

    if (!decoded) {
      return NextResponse.json({ error: "Missing doc number" }, { status: 400 });
    }

    const config = getPmxConfig();
    const host = config.pmxHost || "pmxapi.stonex.com";

    // Authenticate with PMX
    const loginResult = await pmxLogin(config);
    if (!loginResult.ok || !loginResult.session) {
      return NextResponse.json(
        { error: loginResult.error || "PMX authentication failed" },
        { status: 502 },
      );
    }
    const session = loginResult.session;

    // Fetch confirmation from PMX API
    // The PMX API endpoint for trade confirmations
    const url = `https://${host}/user/getConfirmation?docno=${encodeURIComponent(decoded)}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/pdf, application/json, */*",
        "User-Agent": "Foundation/1.0",
        Origin: "https://pmxecute.stonex.com",
        Referer: "https://pmxecute.stonex.com/",
        "x-auth": session.xAuth,
        sid: session.sid,
        username: session.username,
        platform: session.platform,
        location: session.location,
        "cache-control": session.cacheControl,
        "content-type": session.contentType,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      console.error(`PMX confirmation fetch failed: ${resp.status} ${resp.statusText}`);
      return NextResponse.json(
        { error: `PMX returned ${resp.status}: ${resp.statusText}` },
        { status: resp.status >= 400 && resp.status < 600 ? resp.status : 502 },
      );
    }

    const contentType = resp.headers.get("content-type") || "application/pdf";

    // If it's a PDF, stream it back
    if (contentType.includes("pdf")) {
      const body = await resp.arrayBuffer();
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${decoded.replace(/\//g, "_")}.pdf"`,
        },
      });
    }

    // If it's not a PDF (could be JSON error), forward the response
    const text = await resp.text();
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("Confirmation fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch confirmation" },
      { status: 500 },
    );
  }
}
