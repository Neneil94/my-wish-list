import { defineConfig, loadEnv, type Plugin } from 'vite'
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Setzt im Produktions-Build eine strikte Content-Security-Policy als <meta>-Tag.
 * GitHub Pages erlaubt keine eigenen HTTP-Header, daher der Meta-Weg.
 * (frame-ancestors wirkt per Meta nicht – dafür gibt es Frame-Busting in main.tsx.)
 */
function cspPlugin(supabaseUrl: string): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      let origin: string
      try {
        const url = new URL(supabaseUrl)
        if (url.protocol !== 'https:') throw new Error('must be https')
        origin = url.origin
      } catch {
        throw new Error('VITE_SUPABASE_URL fehlt oder ist keine gültige https-URL.')
      }
      const csp = [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "font-src 'self'",
        "img-src 'self' data:",
        `connect-src ${origin}`,
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
        'upgrade-insecure-requests',
      ].join('; ')
      return html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    // Relativer Pfad + Hash-Routing: funktioniert unter https://<user>.github.io/<repo>/
    base: './',
    plugins: [react(), tailwindcss(), cspPlugin(env.VITE_SUPABASE_URL ?? '')],
    build: {
      sourcemap: false,
      target: 'es2022',
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
