'use client';

import { useState } from 'react';
import { buttonClass } from '../ui';
import { CopyButton } from './form-controls';

/**
 * De sleutels voor pushmeldingen maken (fase 4, V29). Je eigen browser maakt het sleutelpaar; het
 * gaat niet naar de server en wordt nergens bewaard. Je kopieert het naar Netlify.
 */

function toBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function VapidGenerator({ subject }: { subject: string }) {
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    try {
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
      const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;
      if (!privateKey) throw new Error('geen sleutel');
      setKeys({ publicKey: toBase64url(publicKey), privateKey });
    } catch {
      setError('Deze browser kan geen sleutels maken. Probeer het in een andere browser.');
    }
  }

  const rows = keys
    ? [
        { name: 'VAPID_PUBLIC_KEY', value: keys.publicKey, note: null },
        { name: 'VAPID_PRIVATE_KEY', value: keys.privateKey, note: 'Geheim: vink in Netlify Contains secret values aan.' },
        { name: 'VAPID_SUBJECT', value: subject, note: null },
      ]
    : [];

  return (
    <div className="space-y-3">
      <button type="button" className={buttonClass('secondary', 'sm')} onClick={generate}>
        {keys ? 'Nieuwe sleutels maken' : 'Sleutels maken'}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {keys ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Zet deze drie waarden in Netlify (Environment variables) en start een nieuwe deploy. Ze worden nergens bewaard:
            laad je deze pagina opnieuw, dan zijn ze weg. Deel de privésleutel nooit via chat of mail.
          </p>
          {rows.map((row) => (
            <div key={row.name} className="space-y-1">
              <p className="text-xs font-semibold text-slate-700">{row.name}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 rounded bg-slate-100 px-2 py-1.5 text-xs break-all text-slate-800">{row.value}</code>
                <CopyButton text={row.value} label="Kopieer" />
              </div>
              {row.note ? <p className="text-xs text-rose-700">{row.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
