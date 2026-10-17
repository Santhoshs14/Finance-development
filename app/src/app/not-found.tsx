import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-4 font-rounded text-6xl font-bold text-brand">404</div>
        <h2 className="mb-2 text-title3 text-foreground">
          Page not found
        </h2>
        <p className="mb-6 text-subhead text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
