/**
 * Firestore security-rules tests (emulator-backed).
 *
 * Verifies the per-user data model:
 *   - Owners can read/write their own named + catch-all subcollections.
 *   - The admin-only locked collections (passkeys / security / audit) are
 *     READ-only from the client and can NEVER be written, even though a
 *     permissive catch-all rule also matches their paths.
 *   - Non-owners are denied everywhere.
 *
 * Skipped automatically when `FIRESTORE_EMULATOR_HOST` is not set, so
 * unit-only CI runs still pass. Run via:
 *   firebase emulators:exec --only firestore,auth "npm run test:int"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const EMULATOR_RUNNING = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!EMULATOR_RUNNING)("firestore.rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, portStr] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
    testEnv = await initializeTestEnvironment({
      projectId: "wf-rules-test",
      firestore: {
        host,
        port: Number(portStr),
        rules: readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  const ALICE = "alice";
  const BOB = "bob";

  it("lets an owner read and write their own transactions", async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const ref = doc(db, `users/${ALICE}/transactions/t1`);
    await assertSucceeds(
      setDoc(ref, { amount: -100, date: "2026-01-01", category: "Food" })
    );
    await assertSucceeds(getDoc(ref));
  });

  it("lets an owner read and write an un-named (catch-all) subcollection", async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const ref = doc(db, `users/${ALICE}/somethingBrandNew/x1`);
    await assertSucceeds(setDoc(ref, { foo: "bar" }));
    await assertSucceeds(getDoc(ref));
  });

  it.each(["passkeys", "security", "audit"])(
    "denies client WRITES to the locked %s collection (even via catch-all)",
    async (collection) => {
      const db = testEnv.authenticatedContext(ALICE).firestore();
      const ref = doc(db, `users/${ALICE}/${collection}/x1`);
      await assertFails(setDoc(ref, { tampered: true }));
    }
  );

  it.each(["passkeys", "security", "audit"])(
    "allows the owner to READ their %s collection",
    async (collection) => {
      // Seed with rules disabled (Admin SDK writes these in production).
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `users/${ALICE}/${collection}/x1`), {
          seeded: true,
        });
      });
      const db = testEnv.authenticatedContext(ALICE).firestore();
      await assertSucceeds(getDoc(doc(db, `users/${ALICE}/${collection}/x1`)));
    }
  );

  it("denies a non-owner from reading or writing another user's data", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${ALICE}/transactions/t1`), {
        amount: -100,
        date: "2026-01-01",
        category: "Food",
      });
    });
    const bobDb = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(getDoc(doc(bobDb, `users/${ALICE}/transactions/t1`)));
    await assertFails(
      setDoc(doc(bobDb, `users/${ALICE}/transactions/t2`), {
        amount: -1,
        date: "2026-01-02",
        category: "Food",
      })
    );
  });

  it("denies an unauthenticated client entirely", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, `users/${ALICE}/transactions/t1`)));
    await assertFails(
      setDoc(doc(anon, `users/${ALICE}/transactions/t1`), { amount: -1 })
    );
  });
});
