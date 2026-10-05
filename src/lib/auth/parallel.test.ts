import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadWhileChecking } from './parallel';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('loadWhileChecking', () => {
  const unhandled = vi.fn();
  process.on('unhandledRejection', unhandled);
  afterEach(() => unhandled.mockClear());

  it('laadt tegelijk met de controle, niet erna', async () => {
    const order: string[] = [];
    const result = await loadWhileChecking(
      async () => {
        order.push('controle start');
        await wait(20);
        order.push('controle klaar');
        return 'kijker';
      },
      async () => {
        order.push('laden start');
        await wait(20);
        order.push('laden klaar');
        return 'gegevens';
      },
    );
    expect(result).toEqual(['kijker', 'gegevens']);
    expect(order.indexOf('laden start')).toBeLessThan(order.indexOf('controle klaar'));
  });

  it('laat de controle winnen als die iemand wegstuurt, ook als het laden mislukt', async () => {
    const redirect = new Error('NEXT_REDIRECT');
    await expect(
      loadWhileChecking(
        async () => {
          await wait(10);
          throw redirect;
        },
        async () => {
          throw new Error('Geen rechten');
        },
      ),
    ).rejects.toBe(redirect);
    await wait(20);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('geeft een mislukt laden door als de controle slaagt', async () => {
    const failure = new Error('Laden van de groepen is mislukt');
    await expect(loadWhileChecking(async () => 'kijker', async () => Promise.reject(failure))).rejects.toBe(failure);
  });

  it('vangt ook een fout die meteen optreedt bij het starten van het laden', async () => {
    const redirect = new Error('NEXT_REDIRECT');
    const load = (): Promise<string> => {
      throw new Error('meteen mis');
    };
    await expect(loadWhileChecking(async () => Promise.reject(redirect), load)).rejects.toBe(redirect);
    await wait(10);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
