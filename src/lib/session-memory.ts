// Flüchtiger Speicher (nur im RAM, nie in localStorage):
//  * das Zugangspasswort zwischen Gate und Registrierung
//  * ein frisch erzeugter Wiederherstellungscode zur einmaligen Anzeige
let accessCode: string | null = null
let pendingRecoveryCode: string | null = null

const GATE_FLAG = 'mwl-gate'

export const gate = {
  pass(code: string) {
    accessCode = code
    try { sessionStorage.setItem(GATE_FLAG, '1') } catch { /* ignore */ }
  },
  /** Nur UX: Login-Seite nicht vor dem Gate zeigen. Echte Prüfung passiert serverseitig. */
  passed(): boolean {
    if (accessCode) return true
    try { return sessionStorage.getItem(GATE_FLAG) === '1' } catch { return false }
  },
  code(): string | null {
    return accessCode
  },
}

export const recoveryCodeMemory = {
  set(code: string) { pendingRecoveryCode = code },
  take(): string | null {
    const c = pendingRecoveryCode
    pendingRecoveryCode = null
    return c
  },
}
