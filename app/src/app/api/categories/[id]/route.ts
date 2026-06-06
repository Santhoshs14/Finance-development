import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const docRef = adminDb.doc(`users/${uid}/categories/${id}`);
  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  await docRef.delete();
  return NextResponse.json({ message: "Category deleted" });
}
