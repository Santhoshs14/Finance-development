/**
 * WebAuthn (passkey) helpers.
 *
 * We support per-user passkeys stored under `users/{uid}/passkeys/{credentialId}`.
 * Clients call the four `/api/auth/webauthn/*` routes:
 *   - `register-options` → returns PublicKeyCredentialCreationOptions
 *   - `register-verify` → finalizes registration after the browser prompt
 *   - `auth-options`    → returns PublicKeyCredentialRequestOptions
 *   - `auth-verify`     → exchanges the assertion for a Firebase custom token
 *
 * Only the Admin SDK may write to the `passkeys` subcollection (enforced
 * in Firestore rules).
 */
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface PasskeyDoc {
  credentialId: string; // base64url
  publicKey: string; // base64url COSE
  counter: number;
  deviceType?: string;
  backedUp?: boolean;
  transports?: string[];
  label?: string;
  createdAt?: FirebaseFirestore.Timestamp;
  lastUsedAt?: FirebaseFirestore.Timestamp;
}

export interface PasskeyChallengeDoc {
  challenge: string;
  type: "registration" | "authentication";
  expiresAt: number; // ms epoch
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min

export function rpId(): string {
  // Production hostname (without port). Vercel injects `VERCEL_URL` for previews.
  const explicit = process.env.WEBAUTHN_RP_ID;
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return vercel.replace(/^https?:\/\//, "").split("/")[0] ?? "localhost";
  return "localhost";
}

export function rpName(): string {
  return process.env.WEBAUTHN_RP_NAME ?? "WealthFlow";
}

export function expectedOrigin(): string | string[] {
  const explicit = process.env.WEBAUTHN_ORIGIN;
  if (explicit) return explicit.split(",").map((s) => s.trim());
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return ["http://localhost:3000", "https://localhost:3000"];
}

// ─── Challenge storage ──────────────────────────────────────────

/** Save the challenge in Firestore so verify can match it server-side. */
export async function saveChallenge(
  uid: string,
  challenge: string,
  type: "registration" | "authentication"
): Promise<void> {
  await adminDb.doc(`users/${uid}/security/webauthnChallenge`).set({
    challenge,
    type,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function consumeChallenge(
  uid: string,
  type: "registration" | "authentication"
): Promise<string | null> {
  const ref = adminDb.doc(`users/${uid}/security/webauthnChallenge`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as PasskeyChallengeDoc | undefined;
  if (!data || data.type !== type) return null;
  if (data.expiresAt < Date.now()) {
    await ref.delete();
    return null;
  }
  await ref.delete();
  return data.challenge;
}

// ─── Passkey CRUD ───────────────────────────────────────────────

export async function listPasskeys(uid: string): Promise<PasskeyDoc[]> {
  const snap = await adminDb.collection(`users/${uid}/passkeys`).get();
  return snap.docs.map((d) => d.data() as PasskeyDoc);
}

export async function savePasskey(uid: string, passkey: PasskeyDoc): Promise<void> {
  await adminDb.doc(`users/${uid}/passkeys/${passkey.credentialId}`).set({
    ...passkey,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function updatePasskeyCounter(
  uid: string,
  credentialId: string,
  counter: number
): Promise<void> {
  await adminDb.doc(`users/${uid}/passkeys/${credentialId}`).set(
    {
      counter,
      lastUsedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deletePasskey(uid: string, credentialId: string): Promise<void> {
  await adminDb.doc(`users/${uid}/passkeys/${credentialId}`).delete();
}

/** Look up the user that owns a given credentialId (for sign-in). */
export async function findUserByCredentialId(
  credentialId: string
): Promise<{ uid: string; passkey: PasskeyDoc } | null> {
  const snap = await adminDb
    .collectionGroup("passkeys")
    .where("credentialId", "==", credentialId)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return null;
  // path: users/{uid}/passkeys/{credentialId}
  const segments = doc.ref.path.split("/");
  const uid = segments[1];
  if (!uid) return null;
  return { uid, passkey: doc.data() as PasskeyDoc };
}
