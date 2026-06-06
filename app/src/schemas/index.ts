/**
 * Zod schemas for shared client/server validation.
 *
 * Every domain entity is defined here with its `*Schema` (Zod) and
 * `*Input` / `*Output` inferred TypeScript types. API routes use these
 * to parse + validate request bodies; the frontend can import the same
 * types via the `@/schemas/*` alias.
 */
export * from "./common";
export * from "./transaction";
export * from "./account";
export * from "./category";
export * from "./budget";
export * from "./goal";
export * from "./investment";
export * from "./lending";
export * from "./emi";
export * from "./split";
export * from "./recurring";
export * from "./notification";
export * from "./profile";
export * from "./netWorth";
export * from "./aggregate";
