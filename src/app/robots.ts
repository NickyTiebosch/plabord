import type { MetadataRoute } from 'next';

// Niets laten indexeren: dit is een interne app.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
