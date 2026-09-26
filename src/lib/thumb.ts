import type React from 'react';

// Photos served through /api/thumb (a Vercel function) as small cached previews.
const PROXIED = [
  'https://storage.googleapis.com/glide-prod.appspot.com/',
  'https://jawmcsrcgqvndjhhvovl.supabase.co/storage/',
];

// Small preview of a photo for thumbnails; the full photo is only loaded when it is opened.
export function thumbUrl(url: string, width: number): string {
  if (!PROXIED.some(prefix => url.startsWith(prefix))) return url;
  return `/api/thumb?w=${width}&url=${encodeURIComponent(url)}`;
}

// If the preview can't be made (e.g. running locally without the function), show the original.
export const fallbackTo = (url: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = '1';
  img.src = url;
};
