/**
 * Kentekens (fase 5): opslaan zonder streepjes en in hoofdletters, tonen met streepjes. Puur.
 */

const STORED_PLATE = /^[A-Z0-9]{2,10}$/;

/**
 * Van wat iemand typt naar wat de database bewaart: hoofdletters, zonder streepjes, spaties of
 * punten. `ghp-39-k` en `GHP 39 K` worden allebei `GHP39K`. Geeft `null` als het geen kenteken kan
 * zijn: 2 tot 10 letters en cijfers, zodat ook buitenlandse kentekens passen.
 */
export function normalizePlate(value: string): string | null {
  const plate = value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s\-–.·]/g, '');
  return STORED_PLATE.test(plate) ? plate : null;
}

type Kind = 'letters' | 'digits';

function kindOf(char: string): Kind {
  return /\d/.test(char) ? 'digits' : 'letters';
}

/**
 * Een opgeslagen kenteken met streepjes, zoals op de plaat: GHP39K → GHP-39-K, X920RV → X-920-RV,
 * AB1234 → AB-12-34. Alleen bij zes tekens; andere lengtes (vaak buitenlands) blijven zoals ze zijn.
 */
export function formatPlate(plate: string): string {
  if (plate.length !== 6 || !STORED_PLATE.test(plate)) return plate;
  const groups: string[] = [];
  let current = '';
  for (const char of plate) {
    if (current && kindOf(char) !== kindOf(current.at(-1) ?? char)) {
      groups.push(current);
      current = '';
    }
    current += char;
  }
  groups.push(current);
  if (groups.length === 3) return groups.join('-');
  // Twee groepen van 4 en 2 (zoals AB-12-34 of 12-34-AB): de groep van vier in tweeën.
  if (groups.length === 2) {
    const [first = '', second = ''] = groups;
    if (first.length === 4) return [first.slice(0, 2), first.slice(2), second].join('-');
    if (second.length === 4) return [first, second.slice(0, 2), second.slice(2)].join('-');
  }
  if (groups.length === 1) return [plate.slice(0, 2), plate.slice(2, 4), plate.slice(4)].join('-');
  return plate;
}

/** Voor zoeken: wat iemand typt, genormaliseerd, maar ook een deel van een kenteken (`39K`). */
export function plateQuery(value: string): string {
  return value
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}
