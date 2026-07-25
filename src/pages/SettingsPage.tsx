import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Save, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function SettingsPage() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('live-music-autoplay') === 'true')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    void supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => setFullName(data?.full_name || ''))
  }, [user])

  const goToPlayer = () => {
    window.location.href = '/'
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    setNotice('')
    setError('')
    const { error: updateError } = await supabase.from('profiles').update({ full_name: fullName.trim() || null }).eq('id', user.id)
    if (updateError) setError(`Não foi possível salvar: ${updateError.message}`)
    else {
      localStorage.setItem('live-music-autoplay', String(autoplay))
      setNotice('Configurações salvas com sucesso.')
    }
    setSaving(false)
  }

  return (
    <main className="account-admin-page">
      <section className="account-admin-shell">
        <header className="account-admin-topbar">
          <div className="account-admin-title">
            <span className="account-admin-kicker">ADMINISTRAÇÃO</span>
            <h1><Settings size={30}/> Configurações</h1>
            <p>Personalize sua conta e o comportamento do player.</p>
          </div>
          <button type="button" className="account-back-button" onClick={goToPlayer}>
            <ArrowLeft size={18}/> Voltar ao player
          </button>
        </header>

        {notice && <div className="account-alert success"><CheckCircle2 size={18}/> {notice}</div>}
        {error && <div className="account-alert error">{error}</div>}

        <form className="account-panel account-settings-form" onSubmit={save}>
          <label className="account-field">
            <span>Nome exibido</span>
            <input value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Seu nome" />
          </label>

          <label className="account-toggle">
            <div>
              <strong>Reprodução automática</strong>
              <small>Permitir que a próxima faixa seja iniciada automaticamente.</small>
            </div>
            <input type="checkbox" checked={autoplay} onChange={event => setAutoplay(event.target.checked)} />
          </label>

          <div className="account-actions">
            <button className="account-save-button" disabled={saving}>
              <Save size={17}/> {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
