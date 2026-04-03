/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold ring-offset-background transition-[transform,box-shadow,background-position,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-primary/40 brand-gradient-bg shadow-[0_12px_24px_rgba(15,23,42,0.35)] hover:shadow-[0_16px_30px_rgba(15,23,42,0.45)]",
        destructive: "border border-rose-500/50 bg-rose-500/90 text-white shadow-[0_12px_24px_rgba(239,68,68,0.25)] hover:bg-rose-500",
        outline: "border border-border/60 bg-transparent text-foreground hover:bg-muted/40",
        secondary: "border border-border/50 bg-secondary/80 text-secondary-foreground hover:bg-secondary",
        ghost: "border border-transparent text-foreground hover:border-border/60 hover:bg-muted/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 py-3 text-[0.95rem]",
        sm: "h-11 px-4",
        lg: "h-14 px-10 text-base",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onMouseDown, onClick, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const [ripple, setRipple] = React.useState<{ x: number; y: number; key: number } | null>(null);

    if (asChild) {
      return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setRipple({ x: event.clientX - rect.left, y: event.clientY - rect.top, key: Date.now() });
          onMouseDown?.(event);
        }}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => onClick?.(event)}
        {...props}
      >
        {children}
        {ripple ? <span key={ripple.key} className="cyber-btn-ripple" style={{ left: ripple.x, top: ripple.y }} aria-hidden="true" /> : null}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
