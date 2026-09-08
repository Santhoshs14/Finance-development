"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent, Input, EmptyState } from "@/components/ui";
import { CALCULATORS } from "@/components/calculators";

export default function CalculatorsPage() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CALCULATORS;
    return CALCULATORS.filter(
      (calc) =>
        calc.title.toLowerCase().includes(q) ||
        calc.description.toLowerCase().includes(q) ||
        calc.keywords.some((keyword) => keyword.includes(q))
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calculators</h1>
          <p className="text-sm text-muted-foreground">
            {CALCULATORS.length} planning tools for investments, loans, tax and retirement
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search calculators"
            placeholder="Search calculators…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No calculators found"
          description={`Nothing matches “${query}”. Try a different term.`}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(({ slug, title, description, icon: Icon }) => (
            <Link key={slug} href={`/calculators/${slug}`} className="group">
              <Card interactive className="h-full">
                <CardContent className="p-5 flex items-start gap-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand/10 text-brand shrink-0 transition-colors group-hover:bg-brand group-hover:text-white">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
