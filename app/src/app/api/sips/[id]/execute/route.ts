import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { executeSipNow } from "@/server/sip/engine";

/**
 * POST /api/sips/[id]/execute — run one installment immediately ("Invest now").
 * Uses the latest available NAV. Idempotent for the current day.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const result = await executeSipNow(auth.uid, id);

  if (result.status === "skipped") {
    const noNav = result.reason === "no-nav";
    return NextResponse.json(
      {
        error: noNav
          ? "NAV is not available yet for this scheme — try again after the daily NAV refresh."
          : `SIP not executed (${result.reason}).`,
        ...result,
      },
      { status: noNav ? 409 : 400 }
    );
  }

  return NextResponse.json({ message: "SIP executed", ...result });
}
