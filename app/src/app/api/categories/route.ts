import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createCategorySchema } from "@/schemas/category";
import { zodErrorResponse } from "@/lib/api-handler";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const snapshot = await adminDb
    .collection(`users/${uid}/categories`)
    .orderBy("name")
    .get();

  const categories = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { name, type, icon, color, tax_section, classification } = parsed.data;

  const data = {
    name,
    type,
    icon: icon || "tag",
    color: color || "#6b7280",
    ...(tax_section ? { tax_section } : {}),
    ...(classification ? { classification } : {}),
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await adminDb.collection(`users/${uid}/categories`).add(data);
  return NextResponse.json({ id: ref.id, message: "Category created" }, { status: 201 });
}
