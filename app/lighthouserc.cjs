/**
 * Lighthouse CI config — runs against a built+started Next.js app.
 *
 * Thresholds intentionally conservative; CI uploads the full report
 * as an artifact for inspection.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start",
      startServerReadyPattern: "ready",
      url: [
        "http://localhost:3000/login",
        "http://localhost:3000/offline",
      ],
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--no-sandbox --disable-gpu",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.7 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],
        "categories:seo": ["warn", { minScore: 0.85 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
