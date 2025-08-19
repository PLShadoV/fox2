import map from '@/public/rcem.json';

export async function GET() {
  return new Response(JSON.stringify({ ok: true, map }), { headers: { 'content-type': 'application/json' } });
}
