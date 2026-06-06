import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex h-9 w-full rounded-lg border bg-transparent px-3 py-1 text-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      state: {
        default:
          "border-input shadow-[var(--elev-1)] focus:border-brand/60 focus:shadow-[0_0_0_3px_hsl(var(--ring)/0.18),var(--elev-1)]",
        success:
          "border-success/60 focus:border-success focus:shadow-[0_0_0_3px_hsl(var(--success)/0.18),var(--elev-1)]",
        error:
          "border-danger/60 focus:border-danger focus:shadow-[0_0_0_3px_hsl(var(--danger)/0.18),var(--elev-1)]",
      },
      size: {
        default: "h-9",
        sm: "h-8 text-xs",
        lg: "h-11 text-base",
      },
    },
    defaultVariants: {
      state: "default",
      size: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, state, size, ...props }, ref) => (
    <input
      type={type}
      className={cn(inputVariants({ state, size }), className)}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input, inputVariants };
