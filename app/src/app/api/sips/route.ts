import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { createSipSchema } from "@/schemas";
import { createSip, listSips } from "@/server/repos/sips";

/** GET /api/sips — list the user's SIP schedules (soonest due first). */
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const sips = await listSips(auth.uid);
  return NextResponse.json({ sips });
}

/** POST /api/sips — create a SIP schedule. */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const id = await createSip(auth.uid, parsed.data);
  return NextResponse.json({ id, message: "SIP created" }, { status: 201 });
}
