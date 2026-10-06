/**
 * Start het laden meteen, maar geef de gegevens pas terug als de controle slaagt (besluit V31).
 * Zo wachten de gegevens niet op de controle wie er kijkt: dat scheelt een rondgang naar de
 * database. Stuurt de controle iemand weg (een redirect is in Next.js een fout), dan wint die, en
 * levert een mislukt laden geen onafgehandelde fout op.
 */
export async function loadWhileChecking<V, T>(check: () => Promise<V>, load: () => Promise<T>): Promise<[V, T]> {
  const pending = Promise.resolve().then(load);
  pending.catch(() => undefined);
  const viewer = await check();
  return [viewer, await pending];
}
