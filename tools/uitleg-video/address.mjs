// Het adres van Planbord in de video's, de PDF en de schermafbeeldingen (besluit V32), zonder https://.
// Altijd expliciet meegeven, zodat er nooit een oud adres in beeld komt: UITLEG_ADRES=planbord-ten.vercel.app
export function guideAddress() {
  const address = process.env.UITLEG_ADRES?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!address) throw new Error('Zet UITLEG_ADRES op het adres van Planbord, bijvoorbeeld UITLEG_ADRES=planbord-ten.vercel.app');
  return address;
}
