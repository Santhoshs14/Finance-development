/**
 * POST /api/auth/webauthn/register-options
 * Returns PublicKeyCredentialCreationOptions for the current user.
 * Requires an authenticated session (Bearer token).
 */
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { adminAuth } from "@/lib/firebase-admin";
import { createHandler } from "@/lib/api-handler";
import { listPasskeys, rpId, rpName, saveChallenge } from "@/lib/webauthn";

export const POST = createHandler(
  { event: "auth.webauthn.register_options" },
  async ({ uid }) => {
    const user = await adminAuth.getUser(uid);
    const existing = await listPasskeys(uid);

    const options = await generateRegistrationOptions({
      rpName: rpName(),
      rpID: rpId(),
      userID: Buffer.from(uid, "utf8"),
      userName: user.email ?? user.uid,
      userDisplayName: user.displayName ?? user.email ?? "WealthFlow user",
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: existing.map((p) => ({
        id: p.credentialId,
        type: "public-key",
        transports: p.transports as ("ble" | "internal" | "nfc" | "usb" | "hybrid")[] | undefined,
      })),
    });

    await saveChallenge(uid, options.challenge, "registration");
    return options;
  }
);
