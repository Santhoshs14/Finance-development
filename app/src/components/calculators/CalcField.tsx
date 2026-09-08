"use client";

import { useId } from "react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

interface CalcFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** "₹" renders as a prefix; anything else ("%", "yrs", "mo") as a suffix. */
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  slider?: boolean;
  hint?: string;
  placeholder?: string;
  className?: string;
}

export function CalcField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
  slider = false,
  hint,
  placeholder,
  className,
}: CalcFieldProps) {
  const id = useId();
  const parsed = value.trim() === "" ? NaN : Number(value);
  const isPrefix = unit === "₹";

  let error: string | null = null;
  if (value.trim() === "") error = "Required";
  else if (!Number.isFinite(parsed)) error = "Enter a number";
  else if (min != null && parsed < min) error = `Minimum ${min}`;
  else if (max != null && parsed > max) error = `Maximum ${max}`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="block text-[11px] font-medium text-muted-foreground"
      >
        {label}
        {unit && !isPrefix && (
          <span className="ml-1 normal-case text-muted-foreground/70">({unit})</span>
        )}
      </label>

      <div className="relative">
        {isPrefix && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          >
            ₹
          </span>
        )}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          state={error ? "error" : "default"}
          className={cn(isPrefix && "pl-7")}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      {slider && min != null && max != null && (
        <input
          type="range"
          aria-label={`${label} slider`}
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : min}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-1 accent-[hsl(var(--brand))] cursor-pointer"
        />
      )}

      {(error || hint) && (
        <p
          id={`${id}-msg`}
          className={cn(
            "text-[11px]",
            error ? "text-danger" : "text-muted-foreground"
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

interface CalcSegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function CalcSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: CalcSegmentedProps<T>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="block text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 min-w-fit px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              value === option.value
                ? "bg-brand text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
