import { NextResponse } from "next/server";

// RFC 9116. Expiry must stay within ~1 year; bump it when reviewing.
export async function GET() {
  const contact =
    process.env.SECURITY_CONTACT_EMAIL || "security@wealthflow.app";
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const body = [
    `Contact: mailto:${contact}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    "Policy: /security",
    "",
    "# We do not currently run a paid bounty, but we credit reporters.",
    "# Please allow 90 days before public disclosure.",
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
