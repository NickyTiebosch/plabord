import { describe, expect, it } from 'vitest';
import { safeNextPath } from './redirect';

describe('safeNextPath', () => {
  it('laat interne paden door', () => {
    expect(safeNextPath('/verlof?weergave=jaar')).toBe('/verlof?weergave=jaar');
  });

  it('weigert externe adressen en rare invoer', () => {
    expect(safeNextPath('https://example.com')).toBe('/');
    expect(safeNextPath('//example.com')).toBe('/');
    expect(safeNextPath('/\\example.com')).toBe('/');
    expect(safeNextPath('/inloggen')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });
});
