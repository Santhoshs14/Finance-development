import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/notifications
 * Returns the user's recent notifications (last 50).
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const snapshot = await adminDb
    .collection(`users/${uid}/notifications`)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const notifications = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  }));

  return NextResponse.json({ notifications });
}

/**
 * POST /api/notifications
 * Create a notification (internal use or manual trigger).
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { type, title, message } = body;

  if (!type || !title || !message) {
    return NextResponse.json(
      { error: "type, title, and message are required" },
      { status: 400 }
    );
  }

  const ref = await adminDb.collection(`users/${uid}/notifications`).add({
    type,
    title,
    message,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ id: ref.id }, { status: 201 });
}

/**
 * PATCH /api/notifications
 * Mark notifications as read. Body: { ids: string[] } or { markAllRead: true }
 */
export async function PATCH(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { ids, markAllRead } = body;

  if (markAllRead) {
    const unreadSnap = await adminDb
      .collection(`users/${uid}/notifications`)
      .where("read", "==", false)
      .get();

    const batch = adminDb.batch();
    unreadSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();

    return NextResponse.json({ updated: unreadSnap.size });
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "ids array or markAllRead required" },
      { status: 400 }
    );
  }

  const batch = adminDb.batch();
  for (const id of ids.slice(0, 50)) {
    const ref = adminDb.doc(`users/${uid}/notifications/${id}`);
    batch.update(ref, { read: true });
  }
  await batch.commit();

  return NextResponse.json({ updated: ids.length });
}

/**
 * DELETE /api/notifications
 * Delete old notifications. Body: { ids: string[] } or { clearAll: true }
 */
export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { ids, clearAll } = body;

  if (clearAll) {
    const allSnap = await adminDb
      .collection(`users/${uid}/notifications`)
      .get();

    const batch = adminDb.batch();
    allSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return NextResponse.json({ deleted: allSnap.size });
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "ids array or clearAll required" },
      { status: 400 }
    );
  }

  const batch = adminDb.batch();
  for (const id of ids.slice(0, 50)) {
    batch.delete(adminDb.doc(`users/${uid}/notifications/${id}`));
  }
  await batch.commit();

  return NextResponse.json({ deleted: ids.length });
}
