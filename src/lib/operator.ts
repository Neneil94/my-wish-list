// Angaben zur betreibenden Person – absichtlich nicht im (öffentlichen) Repository,
// sondern als Build-Variablen (GitHub-Environment "github-pages" bzw. .env.local).

const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

export const operator = {
  /** z. B. "Max Mustermann" */
  name: clean(import.meta.env.VITE_OPERATOR_NAME),
  /** z. B. eine E-Mail-Adresse; wird nur als Text angezeigt. */
  contact: clean(import.meta.env.VITE_OPERATOR_CONTACT),
  /** Region des Supabase-Projekts, z. B. "EU (Frankfurt)". */
  dataRegion: clean(import.meta.env.VITE_DATA_REGION),
}
