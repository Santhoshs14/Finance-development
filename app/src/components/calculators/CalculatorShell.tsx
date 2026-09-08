"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface CalculatorShellProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function CalculatorShell({
  title,
  description,
  icon: Icon,
  action,
  children,
}: CalculatorShellProps) {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="space-y-3">
        <Link
          href="/calculators"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Calculators
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand/10 text-brand shrink-0">
              <Icon className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}
