import { FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function ResetPasswordPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  if (!user) return <Navigate to="/login" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setMessage(error.message)
    else {
      setMessage('Senha atualizada com sucesso.')
      window.setTimeout(() => navigate('/'), 1200)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-white/10 bg-black/20 p-8 backdrop-blur">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-live-gold">LIVE MUSIC</p>
        <h1 className="mt-3 text-3xl font-black">Definir nova senha</h1>
        <input className="mt-8 w-full rounded-2xl border border-white/10 bg-live-ink/70 px-4 py-4 outline-none focus:border-live-gold/70" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha" />
        {message && <p className="mt-4 text-sm text-live-cream">{message}</p>}
        <button className="mt-5 w-full rounded-2xl bg-live-gold px-5 py-4 font-black text-live-ink">Atualizar senha</button>
      </form>
    </main>
  )
}
