import type { MetadataRoute } from 'next';

/**
 * Maakt Planbord installeerbaar op het beginscherm. Bewust zonder service worker:
 * geen offline-modus, het rooster komt altijd vers van de server.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Planbord',
    short_name: 'Planbord',
    description: 'Rooster- en verlofplanning van het team.',
    lang: 'nl',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0f766e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
