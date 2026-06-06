/**
 * POST /api/auth/webauthn/auth-verify
 * Verifies an authentication response and returns a Firebase custom
 * token the client can use with `signInWithCustomToken`.
 */
import { z } from "zod";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { adminAuth } from "@/lib/firebase-admin";
import { createHandler, errors } from "@/lib/api-handler";
import {
  consumeChallenge,
  expectedOrigin,
  findUserByCredentialId,
  rpId,
  updatePasskeyCounter,
} from "@/lib/webauthn";
import { appendAudit } from "@/server/repos/profile";

const bodySchema = z.object({
  assertion: z.record(z.string(), z.unknown()),
});

const TEMP_CHALLENGE_UID = "_webauthn_pending";

export const POST = createHandler(
  { event: "auth.webauthn.auth_verify", body: bodySchema, auth: false },
  async ({ body }) => {
    const credentialId = (
      body.assertion as { id?: string; rawId?: string }
    ).id;
    if (!credentialId) throw errors.badRequest("Missing credential id");

    const owner = await findUserByCredentialId(credentialId);
    if (!owner) throw errors.unauthorized("Unknown credential");

    // Try owner-scoped challenge first, fall back to discoverable.
    let challenge = await consumeChallenge(owner.uid, "authentication");
    if (!challenge) {
      challenge = await consumeChallenge(TEMP_CHALLENGE_UID, "authentication");
    }
    if (!challenge) throw errors.badRequest("Challenge expired or missing");

    const verification = await verifyAuthenticationResponse({
      response: body.assertion as unknown as Parameters<
        typeof verifyAuthenticationResponse
      >[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpId(),
      credential: {
        id: owner.passkey.credentialId,
        publicKey: Buffer.from(owner.passkey.publicKey, "base64url"),
        counter: owner.passkey.counter,
        transports: owner.passkey.transports as
          | ("ble" | "internal" | "nfc" | "usb" | "hybrid")[]
          | undefined,
      },
    });

    if (!verification.verified) throw errors.unauthorized("Passkey verification failed");

    await updatePasskeyCounter(
      owner.uid,
      owner.passkey.credentialId,
      verification.authenticationInfo.newCounter
    );

    void appendAudit(owner.uid, "auth.passkey_login", {
      credentialId: owner.passkey.credentialId,
    }).catch(() => {});

    const customToken = await adminAuth.createCustomToken(owner.uid);
    return { customToken };
  }
);
