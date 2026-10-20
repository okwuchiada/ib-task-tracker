import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const GREEN = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900';
const GREY = 'bg-muted text-muted-foreground border-border';

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
  DONE: GREEN,
  SHIPPED: GREEN,
  CANCELLED: GREY,
  ARCHIVED: GREY,
  ADMIN: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
};

/** A shadcn Badge coloured by status (OPEN, DONE, …); `tone` picks the colour when the text differs. */
export function StatusBadge({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[tone ?? String(children)] ?? GREY}>
      {children}
    </Badge>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A labelled form control for the filter and create forms. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <Label className={cn('flex flex-col items-start gap-1.5 text-xs font-normal text-muted-foreground', className)}>
      {label}
      {children}
    </Label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[13px]">{children}</span>;
}

export function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(d: Date) {
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
