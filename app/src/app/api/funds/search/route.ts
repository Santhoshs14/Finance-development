/**
 * GET /api/funds/search?q=axis%20bluechip
 *
 * Public-to-authenticated-users search over the NAV index.
 * Prefix-matches scheme name. Limit 20 results.
 */
import { z } from "zod";
import { createHandler, errors } from "@/lib/api-handler";
import { adminDb } from "@/lib/firebase-admin";

const querySchema = z.object({
  q: z.string().min(2).max(100),
});

export const GET = createHandler(
  { event: "funds.search", query: querySchema },
  async ({ query }) => {
    if (!query.q) throw errors.badRequest("q required");
    const q = query.q.toLowerCase();

    // Firestore doesn't support OR / contains. We do a prefix range scan.
    const snap = await adminDb
      .collection("system/navIndex/funds")
      .orderBy("schemeName")
      .startAt(query.q[0]?.toUpperCase() ?? "")
      .endAt((query.q[0]?.toUpperCase() ?? "") + "\uf8ff")
      .limit(100)
      .get();

    const results = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          schemeCode: data.schemeCode as string,
          schemeName: data.schemeName as string,
          fundHouse: data.fundHouse as string,
          nav: data.nav as number,
          date: data.date as string,
        };
      })
      .filter((f) => f.schemeName.toLowerCase().includes(q))
      .slice(0, 20);

    return { results };
  }
);
