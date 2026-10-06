import { describe, expect, it } from 'vitest';
import { CODE_SENT, afterCodeRequest, afterFailedVerify, haveCode } from './login';

const email = 'sanne@voorbeeld.nl';

describe('inloggen: een code aanvragen', () => {
  it('gaat naar de code als het versturen lukt, en ook bij een onbekend adres', () => {
    expect(afterCodeRequest(email, null)).toEqual({ step: 'code', email, message: CODE_SENT });
    // Zo kan niemand uitproberen welke adressen bestaan.
    expect(afterCodeRequest(email, { status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' })).toEqual({
      step: 'code',
      email,
      message: CODE_SENT,
    });
    expect(afterCodeRequest(email, { status: 400, message: 'Signups not allowed for otp' })).toEqual({
      step: 'code',
      email,
      message: CODE_SENT,
    });
  });

  it('laat de code invullen als er net al een code is gestuurd, met de wachttijd erbij', () => {
    const state = afterCodeRequest(email, {
      status: 429,
      code: 'over_email_send_rate_limit',
      message: 'For security purposes, you can only request this after 42 seconds.',
    });
    expect(state.step).toBe('code');
    expect(state.email).toBe(email);
    expect(state.error).toBeUndefined();
    expect(state.message).toBe(
      'Je hebt net al een code gekregen. Vul de code uit de nieuwste mail in. Geen mail? Over 42 seconden kun je een nieuwe aanvragen.',
    );
    expect(afterCodeRequest(email, { status: 429, message: 'you can only request this after 1 second.' }).message).toContain(
      'Over 1 seconde kun je',
    );
    const older = afterCodeRequest(email, { status: 429, message: 'For security purposes, you can only request this once every 60 seconds' });
    expect(older.step).toBe('code');
    expect(older.message).toContain('Over 60 seconden kun je');
  });

  it('zegt het duidelijk als er voor het hele team te veel codes zijn aangevraagd', () => {
    const busy = {
      step: 'email',
      email,
      error:
        'Er zijn net te veel inlogcodes aangevraagd. Probeer het over een paar minuten opnieuw. Heb je al een code? Tik dan op Ik heb al een code. Lukt het daarna nog niet, vraag het de beheerder.',
    };
    expect(afterCodeRequest(email, { status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' })).toEqual(busy);
    expect(afterCodeRequest(email, { status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' })).toEqual(busy);
    expect(afterCodeRequest(email, { code: 'over_request_rate_limit', message: 'Request rate limit reached' })).toEqual(busy);
  });

  it('meldt een andere fout als mislukt versturen', () => {
    expect(afterCodeRequest(email, { status: 500, message: 'Error sending magic link email' })).toEqual({
      step: 'email',
      email,
      error: 'Versturen lukte niet. Probeer het later opnieuw of vraag de beheerder.',
    });
  });
});

describe('inloggen: de code controleren', () => {
  it('zegt dat de code niet klopt of verlopen is', () => {
    expect(afterFailedVerify(email, { status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' })).toEqual({
      step: 'code',
      email,
      error: 'Deze code klopt niet of is verlopen. Controleer de code of vraag een nieuwe aan.',
    });
  });

  it('zegt bij te veel pogingen dat dezelfde code straks nog werkt', () => {
    expect(afterFailedVerify(email, { status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' })).toEqual({
      step: 'code',
      email,
      error: 'Er wordt net veel ingelogd. Wacht een minuut en probeer dezelfde code dan opnieuw.',
    });
  });
});

describe('inloggen: ik heb al een code', () => {
  it('gaat naar de code zonder een nieuwe aan te vragen', () => {
    expect(haveCode(email)).toEqual({ step: 'code', email, message: 'Vul de code uit de nieuwste mail in.' });
  });
});
