/**
 * POST/GET /api/cron/worker/[job]
 *
 * Invoked by QStash (one call per page of users) for fan-out cron jobs. Auth
 * is a verified QStash signature, or the cron secret for manual ops re-runs.
 */
import { NextRequest } from "next/server";
import { handleWorker } from "@/server/cron/worker";

// Allow up to 5 minutes per page (Vercel Pro). Each page is a bounded slice of
// users, so this is a ceiling, not the expected runtime.
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ job: string }> }
) {
  const { job } = await params;
  return handleWorker(req, job);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ job: string }> }
) {
  return POST(req, ctx);
}
