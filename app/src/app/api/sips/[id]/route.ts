import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { updateSipSchema } from "@/schemas";
import { deleteSip, updateSip } from "@/server/repos/sips";

/** PATCH /api/sips/[id] — edit a SIP (amount, frequency, status, account…). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSipSchema.safeParse(body);
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

  await updateSip(auth.uid, id, parsed.data);
  return NextResponse.json({ message: "SIP updated" });
}

/** DELETE /api/sips/[id] — remove a SIP schedule (holding is untouched). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await deleteSip(auth.uid, id);
  return NextResponse.json({ message: "SIP deleted" });
}
