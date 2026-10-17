import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the iOS text styles from globals.css; otherwise it treats
// `text-title3` as a color and drops it next to `text-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "large-title",
            "title1",
            "title2",
            "title3",
            "headline",
            "body",
            "callout",
            "subhead",
            "footnote",
            "caption",
            "caption2",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validate a post-authentication redirect target to prevent open-redirect
 * attacks. Only same-origin, absolute internal paths (a single leading "/")
 * are permitted. External URLs, protocol-relative URLs ("//evil.com"),
 * backslash tricks ("/\\evil.com") and control characters fall back to
 * `fallback`.
 */
export function safeRedirect(
  target: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!target) return fallback;
  // Must be an absolute internal path beginning with a single "/".
  if (target[0] !== "/") return fallback;
  // Reject protocol-relative ("//host") and backslash-normalised ("/\\host")
  // forms that browsers may treat as absolute external URLs.
  if (target[1] === "/" || target[1] === "\\") return fallback;
  // Reject embedded control characters and backslashes outright.
  if (/[\u0000-\u001f\\]/.test(target)) return fallback;
  return target;
}
