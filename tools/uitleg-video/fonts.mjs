// Inter als lettertype in de schermafbeeldingen (lijkt op het systeemlettertype van een telefoon).
import fs from 'node:fs';
const dir = new URL('./assets/fonts/', import.meta.url);
export function interCss() {
  return [400, 500, 600, 700, 800]
    .map((weight) => {
      const data = fs.readFileSync(new URL(`inter-latin-${weight}-normal.woff2`, dir)).toString('base64');
      return `@font-face{font-family:'Inter';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2');}`;
    })
    .join('\n');
}
