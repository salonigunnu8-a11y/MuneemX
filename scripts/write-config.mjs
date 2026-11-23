// Netlify build step: writes web/js/config.js from environment variables.
// Set SUPABASE_URL and SUPABASE_ANON_KEY in Netlify → Site configuration → Environment variables.
// With no variables the app runs in demo mode.
import { writeFileSync } from 'node:fs';
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
writeFileSync(new URL('../web/js/config.js', import.meta.url),
`// generated at build time by scripts/write-config.mjs
window.MX_CONFIG = {
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(key)}
};
`);
console.log(url ? `MuneemX: cloud mode → ${url}` : 'MuneemX: no Supabase variables found → demo mode');
