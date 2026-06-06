import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl text-card-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
  {
    variants: {
      variant: {
        default: "border border-border/60 bg-card/95 elev-1 hover:elev-2 hover:border-border",
        glass: "glass elev-2 hover:elev-3",
        elevated: "border border-border/40 bg-card elev-3",
        floating: "border border-border/40 bg-card elev-4",
        gradient: "border-0 hero-gradient text-white elev-3",
        outlined: "border border-border bg-transparent",
        ghost: "border-0 bg-transparent",
      },
      interactive: {
        true: "cursor-pointer lift-hover press-feedback",
        false: "",
      },
      glow: {
        none: "",
        brand: "glow-brand",
        success: "glow-success",
        warning: "glow-warning",
        danger: "glow-danger",
        accent: "glow-accent",
        info: "glow-info",
      },
    },
    defaultVariants: {
      variant: "default",
      interactive: false,
      glow: "none",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, glow, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, interactive, glow }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5 pb-3", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-sm font-semibold leading-none tracking-tight text-foreground", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
