/**
 * POST /api/auth/webauthn/auth-options
 * Returns PublicKeyCredentialRequestOptions for sign-in.
 *
 * Accepts an optional `email` so we can scope the credential allowlist
 * to a specific user. Without email, we return a discoverable-credential
 * options object and let the authenticator pick.
 */
import { z } from "zod";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { adminAuth } from "@/lib/firebase-admin";
import { createHandler } from "@/lib/api-handler";
import { listPasskeys, rpId, saveChallenge } from "@/lib/webauthn";

const bodySchema = z.object({
  email: z.email().optional(),
});

const TEMP_CHALLENGE_UID = "_webauthn_pending";

export const POST = createHandler(
  { event: "auth.webauthn.auth_options", body: bodySchema, auth: false },
  async ({ body }) => {
    let allowCredentials: { id: string; type: "public-key"; transports?: string[] }[] | undefined;
    let uidForChallenge: string = TEMP_CHALLENGE_UID;

    if (body.email) {
      try {
        const user = await adminAuth.getUserByEmail(body.email);
        const existing = await listPasskeys(user.uid);
        allowCredentials = existing.map((p) => ({
          id: p.credentialId,
          type: "public-key",
          transports: p.transports,
        }));
        uidForChallenge = user.uid;
      } catch {
        // Don't disclose whether the email exists.
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId(),
      allowCredentials: allowCredentials as Parameters<
        typeof generateAuthenticationOptions
      >[0]["allowCredentials"],
      userVerification: "preferred",
    });

    await saveChallenge(uidForChallenge, options.challenge, "authentication");
    return options;
  }
);
