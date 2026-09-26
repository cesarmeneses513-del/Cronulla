// Vercel function: small, cached previews of inspection photos.
//   GET /api/thumb?w=320&url=<photo url>
// The original photos are ~1 MB each; previews shown at ~100 px only need a few KB.
// Responses are cached by Vercel's CDN for a year, so each preview is made only once.
import sharp from 'sharp';

// Only our own photo sources, so this can't be used as an open proxy.
const ALLOWED = [
  'https://storage.googleapis.com/glide-prod.appspot.com/',
  'https://jawmcsrcgqvndjhhvovl.supabase.co/storage/',
];
const WIDTHS = [160, 320, 480, 640];

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const url = params.get('url') || '';
  const asked = Number(params.get('w')) || 320;
  const width = WIDTHS.find(w => w >= asked) || WIDTHS[WIDTHS.length - 1];

  if (!ALLOWED.some(prefix => url.startsWith(prefix))) {
    return new Response('URL not allowed', { status: 400 });
  }

  try {
    const source = await fetch(url);
    if (!source.ok) return Response.redirect(url, 302);
    const input = Buffer.from(await source.arrayBuffer());
    const output = await sharp(input, { failOn: 'none' })
      .rotate() // respect the phone's EXIF orientation
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    return new Response(output, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    // Anything unexpected: fall back to the original photo.
    return Response.redirect(url, 302);
  }
}
