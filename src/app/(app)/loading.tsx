/**
 * Wat je ziet terwijl een pagina laadt. Next.js toont dit meteen na een tik, zodat de app direct
 * reageert, ook als de gegevens nog onderweg zijn. De kop en de tabbalk blijven gewoon staan.
 */
export default function Loading() {
  return (
    <div role="status" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Even geduld, de pagina laadt.</span>
      <div aria-hidden="true">
        <div className="mb-4 space-y-2">
          <div className="h-7 w-44 rounded-md bg-slate-200" />
          <div className="h-4 w-32 rounded-md bg-slate-100" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex gap-4 border-b border-slate-100 px-4 py-4 last:border-0">
              <div className="h-4 w-14 rounded bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-slate-200" />
                <div className="h-3 w-1/3 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
