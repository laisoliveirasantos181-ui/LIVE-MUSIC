import { useEffect, useState } from 'react'
import { ArrowLeft, Pencil, RefreshCw, Save, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type ProfileRow = {
  id: string
  full_name: string | null
  role: string | null
  plan: string | null
  is_active?: boolean | null
}

export function UsersPage() {
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ProfileRow | null>(null)
  const [saving, setSaving] = useState(false)

  const goToPlayer = () => {
    window.location.href = '/'
  }

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('id, full_name, role, plan, is_active')
      .order('full_name', { ascending: true })

    if (queryError) setError(`Não foi possível carregar os usuários: ${queryError.message}`)
    else setUsers((data || []) as ProfileRow[])
    setLoading(false)
  }

  useEffect(() => { void loadUsers() }, [])

  const saveUser = async () => {
    if (!editing) return
    setSaving(true); setError('')
    const { error: updateError } = await supabase.from('profiles').update({
      full_name: editing.full_name,
      role: editing.role,
      plan: editing.plan,
      is_active: editing.is_active ?? true,
    }).eq('id', editing.id)
    if (updateError) setError(`Não foi possível salvar: ${updateError.message}`)
    else { setEditing(null); await loadUsers() }
    setSaving(false)
  }


  return (
    <main className="account-admin-page">
      <section className="account-admin-shell">
        <header className="account-admin-topbar">
          <div className="account-admin-title">
            <span className="account-admin-kicker">ADMINISTRAÇÃO</span>
            <h1><Users size={30}/> Usuários</h1>
            <p>Edite perfis, planos e status. A criação de login será integrada com segurança na etapa de autenticação da V4.</p>
          </div>
          <div className="account-admin-buttons">
            <button type="button" className="account-back-button" onClick={goToPlayer}>
              <ArrowLeft size={18}/> Voltar ao player
            </button>
            <button type="button" className="account-refresh-button" onClick={() => void loadUsers()} disabled={loading}>
              <RefreshCw size={17}/> Atualizar
            </button>
          </div>
        </header>

        {error && <div className="account-alert error">{error}</div>}

        <section className="account-panel">
          <div className="account-panel-heading">
            <span>CONTAS CADASTRADAS</span>
            <h2>{users.length} usuários</h2>
          </div>

          {loading ? (
            <div className="account-empty"><RefreshCw className="spin-icon"/><h3>Carregando usuários...</h3></div>
          ) : users.length ? (
            <div className="account-user-list">
              {users.map(item => (
                <article className="account-user-row" key={item.id}>
                  <div className="account-user-avatar"><UserRound size={20}/></div>
                  <div className="account-user-copy">
                    <strong>{item.full_name || 'Usuário sem nome'}</strong>
                    <small>{item.plan || 'plano gratuito'} • {item.is_active === false ? 'inativo' : 'ativo'}</small>
                  </div>
                  <span className={`account-role ${item.role === 'admin' ? 'is-admin' : ''}`}>
                    {item.role === 'admin' && <ShieldCheck size={14}/>} {item.role === 'admin' ? 'Administrador' : 'Usuário'}
                  </span><button className="account-edit-button" onClick={() => setEditing(item)}><Pencil size={16}/> Editar</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="account-empty"><Users size={30}/><h3>Nenhum usuário encontrado</h3><p>As contas aparecerão aqui após o cadastro.</p></div>
          )}
        </section>
        {editing && <div className="account-modal-backdrop"><div className="account-modal"><div className="account-modal-header"><h2>Editar usuário</h2><button onClick={() => setEditing(null)}><X/></button></div><label>Nome<input value={editing.full_name || ''} onChange={e => setEditing({...editing, full_name:e.target.value})}/></label><label>Perfil<select value={editing.role || 'user'} onChange={e => setEditing({...editing, role:e.target.value})}><option value="user">Usuário</option><option value="admin">Administrador</option></select></label><label>Plano<select value={editing.plan || 'free'} onChange={e => setEditing({...editing, plan:e.target.value})}><option value="free">Free</option><option value="premium">Premium</option></select></label><label>Status<select value={editing.is_active === false ? 'inactive':'active'} onChange={e => setEditing({...editing, is_active:e.target.value==='active'})}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label><button className="primary-button" onClick={() => void saveUser()} disabled={saving}><Save size={17}/> {saving?'Salvando...':'Salvar alterações'}</button></div></div>}
        <footer className="studio-institutional-footer">LIVE MUSIC Studio Pro • Versão 3.5.7 • © 2026 • Desenvolvido por <strong>Cristiano Lucas dos Santos</strong> • Todos os direitos reservados.</footer>
      </section>
    </main>
  )
}
