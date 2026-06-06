/**
 * Shared test setup for integration tests against the Firebase emulator.
 *
 * Expects `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` to be
 * set in the environment (the `firebase emulators:exec` command does this
 * automatically). All tests run inside the emulator-backed project
 * `ci-dummy-project`.
 */
import "@testing-library/jest-dom/vitest";

process.env.FIREBASE_PROJECT_ID ??= "ci-dummy-project";
process.env.FIREBASE_CLIENT_EMAIL ??= "ci-dummy@ci-dummy-project.iam.gserviceaccount.com";
// A dummy PEM key — the emulator does not verify it.
process.env.FIREBASE_PRIVATE_KEY ??=
  "-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAk0+v/dummy/key/for/emulator/only\n-----END PRIVATE KEY-----\n";

process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= "ci_dummy_key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??= "ci-dummy.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= "ci-dummy-project";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??= "ci-dummy.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??= "000000000";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= "1:000:web:0000";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.warn(
    "[integration] FIRESTORE_EMULATOR_HOST is not set — tests will hit production. Run via `firebase emulators:exec` instead."
  );
}
