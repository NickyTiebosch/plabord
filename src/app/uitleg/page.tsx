import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, buttonClass, cx } from '@/components/ui';
import { GUIDE_DIR, GUIDE_PDF, GUIDE_QUESTIONS, displayAddress, guideTopics, totalMinutes } from '@/lib/guide/topics';
import { siteBaseUrl } from '@/lib/site-url';

export const metadata: Metadata = { title: 'Uitleg' };

/**
 * Uitleg voor collega's (besluit V30): korte video's met de stappen eronder. Te openen zonder in te
 * loggen, zodat je de link al kunt sturen voordat iemand een account heeft. Niet te vinden via
 * zoekmachines (zie de layout, next.config.ts en robots.txt). De video's staan in public/uitleg en
 * laden pas als je op afspelen tikt.
 */
export default async function GuidePage() {
  const address = displayAddress(await siteBaseUrl());
  const topics = guideTopics(address);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium tracking-wide text-brand-700 uppercase">Planbord</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Uitleg voor collega&rsquo;s</h1>
        <p className="mt-2 text-slate-700">
          Korte video&rsquo;s, samen zo&rsquo;n {totalMinutes(topics)} minuten. Geluid is niet nodig. De video&rsquo;s laten een
          verzonnen team zien.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`${GUIDE_DIR}/${GUIDE_PDF}`} className={buttonClass('primary')} download>
            Uitleg als PDF
          </a>
          <Link href="/" className={buttonClass('secondary')}>
            Naar Planbord
          </Link>
        </div>
      </header>

      <nav aria-label="Onderwerpen" className="mb-6">
        <ol className="grid gap-1 sm:grid-cols-2">
          {topics.map((topic, index) => (
            <li key={topic.id}>
              <a href={`#${topic.id}`} className="block rounded-lg px-3 py-2 text-brand-800 hover:bg-brand-50">
                {index + 1}. {topic.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-6">
        {topics.map((topic, index) => (
          <Card key={topic.id} id={topic.id} className="scroll-mt-4 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {index + 1}. {topic.title}
            </h2>
            <p className="mt-1 text-slate-600">{topic.summary}</p>
            <div className={cx('mt-4 grid gap-6', topic.videos.length > 1 && 'sm:grid-cols-2')}>
              {topic.videos.map((video) => (
                <figure key={video.file} className="mx-auto w-full max-w-[300px]">
                  {video.device ? (
                    <figcaption className="mb-2 text-center text-sm font-semibold text-slate-700">{video.device}</figcaption>
                  ) : null}
                  <video
                    controls
                    playsInline
                    preload="none"
                    poster={`${GUIDE_DIR}/${video.file}.jpg`}
                    className="aspect-[9/16] w-full rounded-2xl bg-slate-100 shadow-sm"
                  >
                    <source src={`${GUIDE_DIR}/${video.file}.mp4`} type="video/mp4" />
                  </video>
                </figure>
              ))}
            </div>
            {topic.steps.map((group) => (
              <div key={group.device ?? 'iedereen'} className="mt-5">
                {group.device ? <h3 className="text-sm font-semibold text-slate-900">{group.device}</h3> : null}
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-slate-700">
                  {group.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
            {topic.notes.length > 0 ? (
              <ul className="mt-4 space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                {topic.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-600">{GUIDE_QUESTIONS}</p>
    </main>
  );
}
