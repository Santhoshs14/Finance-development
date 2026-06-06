import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { verifyAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * Standardized error response shape returned by every API route.
 */
export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export class HttpError extends Error {
  constructor(
    public override readonly message: string,
    public readonly status: number,
    public readonly code: string = "HTTP_ERROR",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Helpers for common HTTP errors. */
export const errors = {
  badRequest: (message = "Bad Request", details?: unknown) =>
    new HttpError(message, 400, "BAD_REQUEST", details),
  unauthorized: (message = "Unauthorized") =>
    new HttpError(message, 401, "UNAUTHORIZED"),
  forbidden: (message = "Forbidden") =>
    new HttpError(message, 403, "FORBIDDEN"),
  notFound: (message = "Not Found") =>
    new HttpError(message, 404, "NOT_FOUND"),
  conflict: (message = "Conflict") =>
    new HttpError(message, 409, "CONFLICT"),
  payloadTooLarge: (message = "Payload Too Large") =>
    new HttpError(message, 413, "PAYLOAD_TOO_LARGE"),
  tooManyRequests: (message = "Too Many Requests", retryAfter?: number) =>
    new HttpError(message, 429, "TOO_MANY_REQUESTS", { retryAfter }),
  internal: (message = "Internal Server Error") =>
    new HttpError(message, 500, "INTERNAL_ERROR"),
};

export interface HandlerContext<TParams> {
  req: NextRequest;
  uid: string;
  params: TParams;
}

interface HandlerOptions<TParams, TBody, TQuery> {
  /** Set to `false` to expose the route without auth (e.g. webhooks). Defaults to `true`. */
  auth?: boolean;
  /** Zod schema for the JSON request body (POST/PATCH/PUT). */
  body?: ZodType<TBody>;
  /** Zod schema for parsed URL search params. */
  query?: ZodType<TQuery>;
  /** Optional Zod schema for the dynamic route params object. */
  params?: ZodType<TParams>;
  /** Event name used for log/Sentry tagging. */
  event?: string;
}

type NextRouteContext<TParams> = { params: Promise<TParams> };

type Handler<TParams, TBody, TQuery> = (input: {
  req: NextRequest;
  uid: string;
  body: TBody;
  query: TQuery;
  params: TParams;
}) => Promise<NextResponse | Response | unknown>;

/**
 * Wraps a route handler with auth + Zod validation + structured error reporting.
 *
 * Returns a function with the signature Next.js expects for App-Router handlers:
 * `(req, ctx) => NextResponse`.
 */
export function createHandler<
  TParams extends Record<string, string> = Record<string, never>,
  TBody = undefined,
  TQuery = Record<string, string>,
>(
  options: HandlerOptions<TParams, TBody, TQuery>,
  handler: Handler<TParams, TBody, TQuery>
) {
  const event = options.event ?? "api.request";

  return async function wrapped(
    req: NextRequest,
    ctx?: NextRouteContext<TParams>
  ): Promise<NextResponse> {
    const start = Date.now();
    let uid = "";

    try {
      // Auth (default on)
      if (options.auth !== false) {
        const result = await verifyAuth(req);
        if (result instanceof NextResponse) return result;
        uid = result.uid;
      }

      // Params
      let parsedParams: TParams = {} as TParams;
      if (ctx?.params) {
        const raw = await ctx.params;
        parsedParams = options.params
          ? options.params.parse(raw)
          : (raw as TParams);
      }

      // Query
      let parsedQuery: TQuery = {} as TQuery;
      if (options.query) {
        const { searchParams } = new URL(req.url);
        const raw = Object.fromEntries(searchParams.entries());
        parsedQuery = options.query.parse(raw);
      }

      // Body (only for methods that have one)
      let parsedBody: TBody = undefined as unknown as TBody;
      const method = req.method;
      const hasBody =
        method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
      if (options.body && hasBody) {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          throw errors.badRequest("Invalid JSON body");
        }
        parsedBody = options.body.parse(raw);
      }

      const result = await handler({
        req,
        uid,
        body: parsedBody,
        query: parsedQuery,
        params: parsedParams,
      });

      // Allow handlers to return a NextResponse / Response directly, or a JSON value.
      const response =
        result instanceof NextResponse || result instanceof Response
          ? (result as NextResponse)
          : NextResponse.json(result ?? { ok: true });

      logger.info({
        event,
        uid,
        method,
        path: req.nextUrl.pathname,
        status: response.status,
        duration_ms: Date.now() - start,
      });

      return response;
    } catch (err) {
      return handleError(err, { req, uid, event, start });
    }
  };
}

function handleError(
  err: unknown,
  { req, uid, event, start }: { req: NextRequest; uid: string; event: string; start: number }
): NextResponse {
  if (err instanceof ZodError) {
    logger.warn({
      event: `${event}.validation_error`,
      uid,
      method: req.method,
      path: req.nextUrl.pathname,
      issues: err.issues,
    });
    return NextResponse.json<ApiError>(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
          code: i.code,
        })),
      },
      { status: 400 }
    );
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) {
      logger.error({ event: `${event}.error`, uid, code: err.code }, err);
    } else {
      logger.warn({ event: `${event}.client_error`, uid, code: err.code, status: err.status }, err);
    }
    const body: ApiError = { error: err.message, code: err.code };
    if (err.details !== undefined) body.details = err.details;
    const res = NextResponse.json(body, { status: err.status });
    if (err.code === "TOO_MANY_REQUESTS") {
      const retryAfter = (err.details as { retryAfter?: number } | undefined)?.retryAfter;
      if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
    }
    return res;
  }

  logger.error(
    {
      event: `${event}.unhandled`,
      uid,
      method: req.method,
      path: req.nextUrl.pathname,
      duration_ms: Date.now() - start,
    },
    err
  );

  return NextResponse.json<ApiError>(
    { error: "Internal Server Error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
