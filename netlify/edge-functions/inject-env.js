// ═══════════════════════════════════════════════════════════════
// MicroVest v8 — netlify/edge-functions/inject-env.js
// Netlify Edge Function: Inject environment variables into HTML
// 
// Purpose:
//   Replaces __SUPA_URL__ and __SUPA_KEY__ placeholders in
//   HTML/JS responses with actual env var values at edge.
//   This keeps secrets out of the Git repository.
//
// Setup in Netlify Dashboard → Site → Environment Variables:
//   SUPABASE_URL  = https://zmyiaviafmmwpgxfvsbq.supabase.co
//   SUPABASE_ANON_KEY = eyJhbG...
//   APP_VERSION   = 10.0
//   APP_ENV       = production
// ═══════════════════════════════════════════════════════════════

export default async (request, context) => {
  const url  = new URL(request.url);
  const path = url.pathname;

  // Only process HTML and JS files
  const shouldProcess = path.endsWith('.html') ||
                        path.endsWith('.js')   ||
                        path === '/';

  if (!shouldProcess) {
    return context.next();
  }

  // Get response from origin
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html') && !contentType.includes('javascript')) {
    return response;
  }

  // Read response body
  let body = await response.text();

  // Replace placeholders with env vars
  const replacements = {
    '__SUPA_URL__':     Deno.env.get('SUPABASE_URL')      || '',
    '__SUPA_KEY__':     Deno.env.get('SUPABASE_ANON_KEY') || '',
    '__APP_VERSION__':  Deno.env.get('APP_VERSION')        || '10.0',
    '__APP_ENV__':      Deno.env.get('APP_ENV')            || 'production',
    '__APP_URL__':      Deno.env.get('APP_URL')            || url.origin,
    '__VAPID_KEY__':    Deno.env.get('VAPID_PUBLIC_KEY')   || '',
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    body = body.replaceAll(placeholder, value);
  }

  // Return modified response
  return new Response(body, {
    status:  response.status,
    headers: response.headers,
  });
};

export const config = {
  path: '/*',
  // Only run on HTML/JS, exclude assets
  excludedPath: [
    '/icons/*', '/screenshots/*', '/css/*',
    '*.png', '*.jpg', '*.ico', '*.webp', '*.svg',
    '/manifest.json',
  ],
};
