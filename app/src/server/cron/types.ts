/**
 * Shared contract for fan-out cron jobs.
 *
 * A cron route ("dispatcher") calls {@link CronJob.prepare} once, then fans the
 * users out across many small QStash messages. Each message is delivered to the
 * worker route, which calls {@link CronJob.processUser} for every uid in the
 * page. This replaces the old "one invocation loops every user" design that was
 * bounded by a single Vercel function's max duration.
 *
 * `Ctx` MUST be JSON-serializable — it travels from the dispatcher to the
 * worker inside the QStash message body.
 */
export interface CronJob<Ctx = Record<string, unknown>> {
  /** Stable job name; also the worker route segment (`/api/cron/worker/{name}`). */
  name: string;
  /**
   * How many users to pack into a single worker message. Smaller pages = more
   * parallelism + shorter worker invocations. Defaults to 100.
   */
  usersPerMessage?: number;
  /**
   * Runs once in the dispatcher before fan-out. Use it for work that must
   * happen a single time per run (e.g. fetching an external feed and writing a
   * shared index). The returned context is forwarded to every worker.
   */
  prepare(): Promise<Ctx>;
  /** Runs in the worker for a single user. Should be idempotent. */
  processUser(uid: string, ctx: Ctx): Promise<void>;
}
