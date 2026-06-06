import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { ensureEnv } from "@/lib/env";

function getAdminApp() {
  ensureEnv();
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };

  if (!serviceAccount.projectId) {
    throw new Error(
      "FIREBASE_PROJECT_ID is not set. Add it to .env.local for local dev or Vercel env vars for production."
    );
  }

  return initializeApp({ credential: cert(serviceAccount) });
}

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_, prop) {
    const auth = getAuth(getAdminApp());
    return (auth as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_, prop) {
    const db = getFirestore(getAdminApp());
    const value = (db as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(db);
    }
    return value;
  },
});
