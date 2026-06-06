import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.97] hover:scale-[1.02]",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-brand-foreground shadow-[var(--elev-1)] hover:shadow-[var(--glow-brand),var(--elev-2)]",
        gradient:
          "brand-gradient text-white shadow-[var(--elev-2)] hover:shadow-[var(--glow-brand),var(--elev-3)]",
        secondary: "bg-muted text-foreground hover:bg-muted/80",
        outline:
          "border border-border bg-transparent hover:bg-muted text-foreground hover:border-brand/40",
        ghost: "hover:bg-muted text-foreground",
        danger:
          "bg-danger text-danger-foreground shadow-[var(--elev-1)] hover:shadow-[var(--glow-danger),var(--elev-2)]",
        success:
          "bg-success text-success-foreground shadow-[var(--elev-1)] hover:shadow-[var(--glow-success),var(--elev-2)]",
        warning:
          "bg-warning text-warning-foreground shadow-[var(--elev-1)] hover:shadow-[var(--glow-warning),var(--elev-2)]",
        link: "text-brand underline-offset-4 hover:underline hover:scale-100",
        glass:
          "glass text-foreground hover:bg-card/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6 text-base",
        xl: "h-12 rounded-xl px-8 text-base font-semibold",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
