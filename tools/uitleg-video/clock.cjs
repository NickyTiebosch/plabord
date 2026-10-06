// Zet de klok van Node op UITLEG_DATUM, voor de nagebootste Supabase en Planbord zelf. Zo tonen de
// schermafbeeldingen altijd dezelfde dag als de video's, ook als je ze later opnieuw vastlegt.
// De tijd loopt gewoon door vanaf dat moment. Laden met NODE_OPTIONS="--require=<pad>/clock.cjs".
const target = Date.parse(process.env.UITLEG_DATUM ?? '');
if (Number.isNaN(target)) throw new Error('Zet UITLEG_DATUM, bijvoorbeeld UITLEG_DATUM=2026-10-05T09:00:00+02:00');

const RealDate = Date;
const offset = target - RealDate.now();

class ShiftedDate extends RealDate {
  constructor(...args) {
    super(...(args.length > 0 ? args : [RealDate.now() + offset]));
  }

  static now() {
    return RealDate.now() + offset;
  }
}
// Als eigen eigenschappen: de proxy van Next.js draait in een eigen omgeving en ziet geërfde niet.
ShiftedDate.parse = RealDate.parse;
ShiftedDate.UTC = RealDate.UTC;

globalThis.Date = ShiftedDate;
