import { describe, it, expect } from "vitest";
import { cn, safeRedirect } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════
// cn (classnames utility) - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("cn", () => {
  describe("Basic string merging", () => {
    it("merges single class", () => {
      expect(cn("text-red-500")).toBe("text-red-500");
    });

    it("merges multiple classes", () => {
      expect(cn("text-red-500", "bg-blue-200")).toBe("text-red-500 bg-blue-200");
    });

    it("handles empty string", () => {
      expect(cn("")).toBe("");
    });

    it("handles no arguments", () => {
      expect(cn()).toBe("");
    });
  });

  describe("Tailwind merge behavior", () => {
    it("resolves conflicting text colors (last wins)", () => {
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("resolves conflicting padding", () => {
      expect(cn("p-4", "p-8")).toBe("p-8");
    });

    it("resolves conflicting margin", () => {
      expect(cn("m-2", "m-4")).toBe("m-4");
    });

    it("does not merge non-conflicting classes", () => {
      const result = cn("text-red-500", "bg-blue-200", "p-4");
      expect(result).toContain("text-red-500");
      expect(result).toContain("bg-blue-200");
      expect(result).toContain("p-4");
    });

    it("resolves conflicting display", () => {
      expect(cn("block", "flex")).toBe("flex");
    });
  });

  describe("Conditional classes (clsx behavior)", () => {
    it("handles boolean conditions", () => {
      expect(cn("base", true && "active")).toBe("base active");
      expect(cn("base", false && "active")).toBe("base");
    });

    it("handles undefined values", () => {
      expect(cn("base", undefined, "end")).toBe("base end");
    });

    it("handles null values", () => {
      expect(cn("base", null, "end")).toBe("base end");
    });

    it("handles object syntax", () => {
      expect(cn({ "text-red-500": true, "bg-blue-200": false })).toBe("text-red-500");
    });

    it("handles array syntax", () => {
      expect(cn(["text-red-500", "bg-blue-200"])).toBe("text-red-500 bg-blue-200");
    });

    it("handles mixed inputs", () => {
      const result = cn("base", { active: true, disabled: false }, ["extra"]);
      expect(result).toContain("base");
      expect(result).toContain("active");
      expect(result).not.toContain("disabled");
      expect(result).toContain("extra");
    });
  });

  describe("Edge cases", () => {
    it("handles duplicate classes", () => {
      const result = cn("p-4", "p-4");
      expect(result).toBe("p-4");
    });

    it("handles whitespace-heavy input", () => {
      const result = cn("  text-red-500  ", "  bg-blue-200  ");
      expect(result).toContain("text-red-500");
      expect(result).toContain("bg-blue-200");
    });

    it("handles complex tailwind classes", () => {
      const result = cn(
        "hover:text-red-500",
        "focus:ring-2",
        "sm:text-lg",
        "dark:bg-gray-800"
      );
      expect(result).toContain("hover:text-red-500");
      expect(result).toContain("focus:ring-2");
      expect(result).toContain("sm:text-lg");
      expect(result).toContain("dark:bg-gray-800");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// safeRedirect (open-redirect protection) - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("safeRedirect", () => {
  describe("Allows internal paths", () => {
    it("returns a simple absolute path", () => {
      expect(safeRedirect("/dashboard")).toBe("/dashboard");
    });

    it("returns a nested path with query string", () => {
      expect(safeRedirect("/money/transactions?cycleKey=2026-06")).toBe(
        "/money/transactions?cycleKey=2026-06"
      );
    });

    it("allows the root path", () => {
      expect(safeRedirect("/")).toBe("/");
    });
  });

  describe("Falls back for unsafe or empty targets", () => {
    it("uses default fallback when null/undefined/empty", () => {
      expect(safeRedirect(null)).toBe("/dashboard");
      expect(safeRedirect(undefined)).toBe("/dashboard");
      expect(safeRedirect("")).toBe("/dashboard");
    });

    it("uses a custom fallback", () => {
      expect(safeRedirect(null, "/home")).toBe("/home");
    });

    it("rejects absolute external URLs", () => {
      expect(safeRedirect("https://evil.com")).toBe("/dashboard");
      expect(safeRedirect("http://evil.com")).toBe("/dashboard");
    });

    it("rejects protocol-relative URLs", () => {
      expect(safeRedirect("//evil.com")).toBe("/dashboard");
    });

    it("rejects backslash-normalised URLs", () => {
      expect(safeRedirect("/\\evil.com")).toBe("/dashboard");
      expect(safeRedirect("/\\/evil.com")).toBe("/dashboard");
    });

    it("rejects paths containing backslashes", () => {
      expect(safeRedirect("/foo\\bar")).toBe("/dashboard");
    });

    it("rejects javascript: scheme", () => {
      expect(safeRedirect("javascript:alert(1)")).toBe("/dashboard");
    });

    it("rejects paths with embedded control characters", () => {
      expect(safeRedirect("/foo\nbar")).toBe("/dashboard");
      expect(safeRedirect("/foo\tbar")).toBe("/dashboard");
    });

    it("rejects relative paths without a leading slash", () => {
      expect(safeRedirect("dashboard")).toBe("/dashboard");
    });
  });
});
