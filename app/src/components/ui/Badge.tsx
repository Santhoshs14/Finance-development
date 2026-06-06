import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand/10 text-brand",
        secondary: "border-transparent bg-muted text-muted-foreground",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/10 text-warning",
        danger: "border-transparent bg-danger/10 text-danger",
        info: "border-transparent bg-info/10 text-info",
        outline: "border-border text-foreground",
        solid: "border-transparent bg-brand text-brand-foreground shadow-[var(--elev-1)]",
      },
      pulse: {
        true: "animate-pulse-soft",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      pulse: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, pulse, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, pulse }), className)} {...props} />;
}

export { Badge, badgeVariants };
