import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-emerald-500 mb-4">404</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Page not found
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
