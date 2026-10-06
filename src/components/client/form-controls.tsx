'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { IconCopy } from '../icons';
import { buttonClass, cx } from '../ui';

/** Verzendknop die tijdens het versturen "Bezig…" toont en niet nog een keer ingedrukt kan worden. */
export function SubmitButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  confirm,
  name,
  value,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  className?: string;
  /** Vraag eerst om bevestiging, bijvoorbeeld bij verwijderen. */
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={cx(buttonClass(variant, size), className)}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? 'Bezig…' : children}
    </button>
  );
}

/** Kopieert tekst naar het klembord en laat kort zien dat het gelukt is. */
export function CopyButton({
  text,
  label = 'Kopieer link',
  variant = 'secondary',
}: {
  text: string;
  label?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass(variant, 'md')}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt('Kopieer deze link:', text);
        }
      }}
    >
      <IconCopy />
      {copied ? 'Gekopieerd' : label}
    </button>
  );
}
