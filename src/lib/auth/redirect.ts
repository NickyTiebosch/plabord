/** Alleen interne paden als doel na het inloggen, zodat niemand je naar een andere site kan sturen. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value.startsWith('/inloggen')) return '/';
  return value;
}
