/**
 * POST /api/auth/webauthn/register-verify
 * Finalizes passkey registration after the browser prompt.
 */
import { z } from "zod";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { createHandler, errors } from "@/lib/api-handler";
import {
  consumeChallenge,
  expectedOrigin,
  rpId,
  savePasskey,
} from "@/lib/webauthn";
import { appendAudit } from "@/server/repos/profile";

const bodySchema = z.object({
  attestationResponse: z.record(z.string(), z.unknown()),
  label: z.string().min(1).max(60).optional(),
});

export const POST = createHandler(
  { event: "auth.webauthn.register_verify", body: bodySchema },
  async ({ uid, body }) => {
    const challenge = await consumeChallenge(uid, "registration");
    if (!challenge) throw errors.badRequest("Challenge expired or missing");

    const verification = await verifyRegistrationResponse({
      // The library's expected shape — cast via unknown to satisfy strict TS.
      response: body.attestationResponse as unknown as Parameters<
        typeof verifyRegistrationResponse
      >[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpId(),
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw errors.badRequest("Passkey registration failed verification");
    }

    const { credential } = verification.registrationInfo;
    await savePasskey(uid, {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
      transports: credential.transports as string[] | undefined,
      label: body.label ?? "Default device",
    });

    void appendAudit(uid, "auth.passkey_registered", {
      credentialId: credential.id,
      deviceType: verification.registrationInfo.credentialDeviceType,
    }).catch(() => {});

    return { verified: true };
  }
);
