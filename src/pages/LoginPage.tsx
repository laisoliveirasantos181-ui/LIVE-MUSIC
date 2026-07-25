import { FormEvent, useState } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const { user } = useAuth()
  const location = useLocation()
  const destination = (location.state as { from?: string } | null)?.from || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')

  if (user) return <Navigate to={destination} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setMessage('Enviamos o link de recuperação para o seu e-mail.')
        return
      }

      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: email.split('@')[0] } },
        })
        if (error) throw error
        setMessage('Conta criada. Confira seu e-mail para confirmar o cadastro.')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.')
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'login' ? 'Bem-vindo de volta' : mode === 'register' ? 'Crie sua conta' : 'Recuperar acesso'
  const submitLabel = mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar link'

  return (
    <main className="min-h-screen px-5 py-8 lg:grid lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-12 lg:px-16">
      <section className="mx-auto max-w-2xl py-8 lg:mx-0">
        <Brand />
        <div className="mt-16 max-w-xl">
          <span className="rounded-full border border-live-gold/30 bg-live-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-live-gold">Streaming online e offline</span>
          <h1 className="mt-6 font-['Bebas_Neue'] text-6xl font-normal leading-[.92] tracking-[.025em] text-live-text md:text-8xl">Música que acompanha o seu ritmo.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-live-muted">Uma base profissional em React, Vite, Tailwind e Supabase, pronta para evoluir para player, downloads e APK Android.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-md rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-2xl backdrop-blur-xl md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-live-gold">LIVE MUSIC V1.0</p>
        <h2 className="mt-3 text-3xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-live-muted">Conectado ao seu projeto Supabase.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-live-cream">E-mail</span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-live-ink/70 px-4 focus-within:border-live-gold/70">
              <Mail className="h-5 w-5 text-live-muted" />
              <input className="w-full bg-transparent py-4 outline-none placeholder:text-live-muted/60" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
            </div>
          </label>

          {mode !== 'forgot' && (
            <label className="block">
              <span className="mb-2 block text-sm text-live-cream">Senha</span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-live-ink/70 px-4 focus-within:border-live-gold/70">
                <LockKeyhole className="h-5 w-5 text-live-muted" />
                <input className="w-full bg-transparent py-4 outline-none placeholder:text-live-muted/60" type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-live-muted" aria-label="Mostrar ou ocultar senha">{showPassword ? <EyeOff /> : <Eye />}</button>
              </div>
            </label>
          )}

          {message && <div className="rounded-2xl border border-live-gold/20 bg-live-gold/10 p-3 text-sm text-live-cream">{message}</div>}

          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-live-gold px-5 py-4 font-semibold text-live-ink transition hover:brightness-110 disabled:opacity-60">
            {loading && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {submitLabel}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <button className="text-live-cream hover:text-live-gold" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Já tenho conta' : 'Criar conta'}</button>
          <button className="text-live-muted hover:text-live-gold" onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}>{mode === 'forgot' ? 'Voltar ao login' : 'Esqueci minha senha'}</button>
        </div>
      </section>
    </main>
  )
}
