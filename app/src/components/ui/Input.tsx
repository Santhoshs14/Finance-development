import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex h-11 w-full rounded-[14px] border bg-muted/60 px-3 py-1 text-sm text-foreground transition-[border-color,box-shadow,background-color] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:bg-card focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:rounded-[10px]",
  {
    variants: {
      state: {
        default:
          "border-transparent focus:border-brand/60 focus:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)]",
        success:
          "border-success/60 focus:border-success focus:shadow-[0_0_0_3px_hsl(var(--success)/0.18)]",
        error:
          "border-danger/60 focus:border-danger focus:shadow-[0_0_0_3px_hsl(var(--danger)/0.18)]",
      },
      size: {
        default: "h-11 md:h-9",
        sm: "h-9 text-xs md:h-8",
        lg: "h-12 text-base md:h-11",
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
  ({ className, type, state, size, inputMode, ...props }, ref) => (
    <input
      type={type}
      // Number fields get the decimal keypad on iOS unless told otherwise
      inputMode={inputMode ?? (type === "number" ? "decimal" : undefined)}
      className={cn(inputVariants({ state, size }), className)}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input, inputVariants };
