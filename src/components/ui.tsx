import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...props}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx('text-base font-semibold text-slate-900', className)}>{children}</h2>;
}

export type Tone = 'neutral' | 'brand' | 'absent' | 'requested' | 'closed' | 'warning' | 'success';

const badgeTones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-100',
  absent: 'bg-rose-50 text-rose-700 ring-rose-200',
  requested: 'bg-white text-rose-700 ring-rose-300 border border-dashed border-rose-300',
  closed: 'bg-slate-100 text-slate-500 ring-slate-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const noticeTones = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
} as const;

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof noticeTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-lg border px-3 py-2 text-sm', noticeTones[tone], className)}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children ? <div className="mt-1 text-sm text-slate-600">{children}</div> : null}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function buttonClass(variant: ButtonVariant = 'primary', size: 'md' | 'sm' = 'md'): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
    'disabled:cursor-not-allowed disabled:opacity-60',
    size === 'md' ? 'min-h-11 px-4 text-sm' : 'min-h-9 px-3 text-sm',
    variant === 'primary' && 'bg-brand-700 text-white hover:bg-brand-800',
    variant === 'secondary' && 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
    variant === 'danger' && 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50',
    variant === 'ghost' && 'text-slate-700 hover:bg-slate-100',
  );
}

export function LinkButton({
  href,
  variant = 'secondary',
  size = 'md',
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, 'className'> & {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  className?: string;
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), className)} {...props}>
      {children}
    </Link>
  );
}

export const inputClass = cx(
  'block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900',
  'placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100',
  'disabled:bg-slate-100',
);

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Fieldset({ legend, children, hint }: { legend: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </fieldset>
  );
}

/** Kleine keuzeknop (radio of checkbox) met label, groot genoeg om op te tikken. */
export function Choice({
  type,
  name,
  value,
  label,
  defaultChecked,
  disabled,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  label: ReactNode;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:disabled]:opacity-60">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="size-4 accent-brand-700"
      />
      {label}
    </label>
  );
}

export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('space-y-4', className)}>{children}</div>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-slate-500">{children}</span>;
}
