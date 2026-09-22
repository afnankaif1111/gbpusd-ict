import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow',
        secondary: 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow',
        outline: 'text-foreground border-border',
        bullish: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium',
        bearish: 'border-rose-500/30 bg-rose-500/10 text-rose-400 font-medium',
        accent: 'border-sky-500/30 bg-sky-500/15 text-sky-400 font-medium',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium',
        purple: 'border-purple-500/30 bg-purple-500/10 text-purple-400 font-medium',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
