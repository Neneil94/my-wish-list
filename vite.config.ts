/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** Versionsinfos für die Anzeige in der App (nur öffentliche, unkritische Werte). */
function buildInfo() {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
  let commit = (process.env.GITHUB_SHA ?? '').slice(0, 7)
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      commit = 'dev'
    }
  }
  if (!/^[0-9a-f]{7}$|^dev$/.test(commit)) commit = 'dev'
  return { version: pkg.version, commit, builtAt: new Date().toISOString() }
}

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
  const info = buildInfo()
  return {
    define: {
      __APP_VERSION__: JSON.stringify(info.version),
      __APP_COMMIT__: JSON.stringify(info.commit),
      __APP_BUILT_AT__: JSON.stringify(info.builtAt),
    },
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
