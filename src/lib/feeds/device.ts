/**
 * Herkent een Android-toestel aan de kopteksten van het verzoek (besluit V35). Op Android werkt de
 * knop Toevoegen aan agenda niet: daar opent een webcal-link geen agenda, en de app Google Agenda kan
 * geen agenda via een link toevoegen. Dat kan alleen op de website. Puur.
 *
 * Chrome en andere browsers op basis van Chromium sturen `Sec-CH-UA-Platform` mee, met
 * aanhalingstekens ("Android"). Firefox doet dat niet, maar zet Android in de user-agent.
 */
export function isAndroid(headers: Pick<Headers, 'get'>): boolean {
  const platform = headers.get('sec-ch-ua-platform')?.replace(/"/g, '').trim().toLowerCase();
  return platform === 'android' || /\bandroid\b/i.test(headers.get('user-agent') ?? '');
}
