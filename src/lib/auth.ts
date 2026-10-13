import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './supabase.ts'

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: 'user' | 'admin'
  created_at: string
}
export type AuthState = { ready: boolean; session: Session | null; profile: Profile | null; recovery: boolean }

let state: AuthState = { ready: false, session: null, profile: null, recovery: false }
const listeners = new Set<(next: AuthState) => void>()
let initialized = false

function emit() {
  for (const listener of listeners) listener(state)
}

async function apply(session: Session | null) {
  let profile: Profile | null = null
  if (session) {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    profile = data as Profile | null
  }
  state = { ...state, ready: true, session, profile }
  emit()
}

export function getAuth() {
  return state
}

export function onAuthChange(listener: (next: AuthState) => void) {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

export async function initAuth() {
  if (initialized) return
  initialized = true
  if (!isConfigured) {
    state = { ...state, ready: true }
    emit()
    return
  }
  const { data } = await supabase.auth.getSession()
  await apply(data.session)
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') state = { ...state, recovery: true }
    // Callback içinde Supabase çağrısı beklenmez; kilitlenmeyi önlemek için ertelenir.
    setTimeout(() => void apply(session), 0)
  })
}

export function clearRecovery() {
  state = { ...state, recovery: false }
  emit()
}

const returnUrl = () => window.location.origin + window.location.pathname

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl() } })
}

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export function signUpWithPassword(email: string, password: string, fullName: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: returnUrl() },
  })
}

export function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() })
}

export function updatePassword(password: string) {
  return supabase.auth.updateUser({ password })
}

export function signOut() {
  return supabase.auth.signOut()
}

export function authErrorMessage(message: string) {
  const text = message.toLowerCase()
  if (text.includes('invalid login')) return 'E-posta veya şifre hatalı.'
  if (text.includes('not confirmed')) return 'E-posta adresinizi doğrulamanız gerekiyor. Gelen kutunuzu kontrol edin.'
  if (text.includes('already registered')) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.'
  if (text.includes('password should be')) return 'Şifre en az 8 karakter olmalıdır.'
  if (text.includes('rate limit')) return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyin.'
  if (text.includes('provider is not enabled')) return 'Google ile giriş henüz etkinleştirilmemiş.'
  return message
}
