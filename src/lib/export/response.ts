/** Het antwoord voor een export: een .xlsx-bestand om te downloaden, nooit in een cache. */
export function xlsxResponse(file: Buffer, fileName: string): Response {
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
