import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,box-shadow,transform,opacity,color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] active:opacity-85",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-brand-foreground shadow-[var(--elev-1)] hover:bg-brand/90 hover:shadow-[var(--glow-brand),var(--elev-2)]",
        gradient:
          "brand-gradient text-white shadow-[var(--elev-2)] hover:shadow-[var(--glow-brand),var(--elev-3)]",
        secondary: "bg-muted text-foreground hover:bg-muted/70",
        outline:
          "border border-border bg-card/70 text-foreground hover:bg-foreground/[0.04] hover:border-brand/40",
        ghost: "text-foreground hover:bg-foreground/[0.06]",
        danger:
          "bg-danger text-danger-foreground shadow-[var(--elev-1)] hover:bg-danger/90 hover:shadow-[var(--glow-danger),var(--elev-2)]",
        success:
          "bg-success text-success-foreground shadow-[var(--elev-1)] hover:bg-success/90 hover:shadow-[var(--glow-success),var(--elev-2)]",
        warning:
          "bg-warning text-warning-foreground shadow-[var(--elev-1)] hover:bg-warning/90 hover:shadow-[var(--glow-warning),var(--elev-2)]",
        link: "text-brand underline-offset-4 hover:underline active:scale-100",
        glass:
          "glass-chrome text-foreground",
      },
      size: {
        default: "h-10 px-5 md:h-9 md:px-4",
        sm: "h-9 px-3.5 text-[13px] md:h-8 md:px-3 md:text-xs",
        lg: "h-12 px-6 text-base md:h-10",
        xl: "h-12 px-8 text-base",
        icon: "size-10 md:size-9",
        "icon-sm": "size-9 md:size-8",
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
