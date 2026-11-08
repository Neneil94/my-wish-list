import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { AppError } from './errors'

type Action =
  | { action: 'check-access'; accessCode: string }
  | { action: 'register'; accessCode: string; username: string; displayName: string; password: string }
  | { action: 'reset-password'; username: string; recoveryCode: string; newPassword: string }
  | { action: 'change-password'; currentPassword: string; newPassword: string }
  | { action: 'rotate-recovery'; currentPassword: string }

/** Ruft die Edge Function "account" auf und wirft AppError mit Server-Fehlercode. */
export async function callAccount<T = Record<string, unknown>>(body: Action): Promise<T> {
  const { data, error } = await supabase.functions.invoke('account', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await (error.context as Response).json().catch(() => ({}))
      throw new AppError(typeof payload?.error === 'string' ? payload.error : 'unknown')
    }
    throw new AppError('network')
  }
  return data as T
}
