/**
 * Server-side repository layer.
 *
 * API routes call repos (never `adminDb` directly) so:
 *  1. Firestore reads/writes are centralized and discoverable.
 *  2. Tests can swap repos for in-memory fakes.
 *  3. Future caching / sharding / read-replica logic lives in one place.
 *
 * Every repo function takes `uid` as its first argument and returns a
 * promise. Repos never serialize timestamps or transform shapes — that
 * is the route layer's job.
 */
export * from "./profile";
export * from "./transactions";
export * from "./accounts";
export * from "./categories";
export * from "./budgets";
export * from "./goals";
export * from "./investments";
export * from "./lending";
export * from "./emis";
export * from "./splits";
export * from "./recurring";
export * from "./notifications";
export * from "./netWorth";
export * from "./aggregates";
export * from "./helpers";
