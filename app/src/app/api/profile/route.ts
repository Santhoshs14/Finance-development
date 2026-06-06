import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const docRef = adminDb.doc(`users/${uid}/profile/settings`);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({
      cycleStartDay: 25,
      monthlySalary: 0,
      onboardingComplete: false,
    });
  }

  return NextResponse.json(doc.data());
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const allowedFields = [
    "cycleStartDay", "monthlySalary", "onboardingComplete", "displayName", "currency",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  updates["updatedAt"] = FieldValue.serverTimestamp();

  // Write to root user document (where DataProvider listens for real-time updates)
  const rootDocRef = adminDb.doc(`users/${uid}`);
  await rootDocRef.set(updates, { merge: true });

  // Also keep profile/settings in sync
  const profileDocRef = adminDb.doc(`users/${uid}/profile/settings`);
  await profileDocRef.set(updates, { merge: true });

  return NextResponse.json({ message: "Profile updated" });
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  // Delete subcollections
  const subcollections = [
    "transactions", "accounts", "categories", "aggregates",
    "budgetSnapshots", "goals", "investments", "lending", "profile",
  ];

  for (const sub of subcollections) {
    const colRef = adminDb.collection(`users/${uid}/${sub}`);
    const docs = await colRef.listDocuments();
    const batch = adminDb.batch();
    docs.forEach((d) => batch.delete(d));
    if (docs.length > 0) await batch.commit();
  }

  // Delete user document
  await adminDb.doc(`users/${uid}`).delete();

  // Delete Firebase Auth user
  await adminAuth.deleteUser(uid);

  return NextResponse.json({ message: "Account deleted" });
}
