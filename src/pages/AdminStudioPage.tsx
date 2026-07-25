import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Album, ArrowLeft, CheckCircle2, Disc3, FileAudio, FolderOpen, Loader2, Music2, Pencil, Plus, RefreshCw, Save, Tags, Trash2, UploadCloud, UserRound, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { readAudioMetadata } from '../lib/audioMetadata'

type Profile = { role: string | null; full_name: string | null }
type Artist = { id: string; name: string }
type Genre = { id: string; name: string; slug: string; description: string | null; is_active: boolean }
type AlbumRow = { id: string; title: string; artist_id: string }
type TrackRow = { id: string; title: string; status: string; created_at: string; audio_path: string; cover_path: string | null; genre_id: string | null; artists?: { name: string } | { name: string }[] | null }

type Notice = { type: 'success' | 'error'; text: string } | null
type BatchStatus = 'ready' | 'uploading' | 'success' | 'error'
type BatchItem = {
  id: string
  file: File
  title: string
  artist: string
  album: string
  genre: string
  trackNumber: string
  year: string
  durationSeconds: number | null
  coverFile: File | null
  selected: boolean
  status: BatchStatus
  error: string | null
}

const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function AdminStudioPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [artists, setArtists] = useState<Artist[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [albums, setAlbums] = useState<AlbumRow[]>([])
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [activeTab, setActiveTab] = useState<'dashboard' | 'artist' | 'album' | 'genre' | 'track' | 'batch'>('dashboard')

  const [artistName, setArtistName] = useState('')
  const [artistBio, setArtistBio] = useState('')
  const [albumTitle, setAlbumTitle] = useState('')
  const [albumArtist, setAlbumArtist] = useState('')
  const [albumDate, setAlbumDate] = useState('')
  const [genreName, setGenreName] = useState('')
  const [genreDescription, setGenreDescription] = useState('')
  const [editingGenreId, setEditingGenreId] = useState<string | null>(null)

  const [trackTitle, setTrackTitle] = useState('')
  const [trackArtist, setTrackArtist] = useState('')
  const [trackAlbum, setTrackAlbum] = useState('')
  const [trackGenre, setTrackGenre] = useState('')
  const [trackStatus, setTrackStatus] = useState<'draft' | 'published'>('published')
  const [trackFeatured, setTrackFeatured] = useState(false)
  const [trackDownload, setTrackDownload] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)

  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchReading, setBatchReading] = useState(false)
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchDefaultArtist, setBatchDefaultArtist] = useState('')
  const [batchDefaultAlbum, setBatchDefaultAlbum] = useState('')
  const [batchDefaultGenre, setBatchDefaultGenre] = useState('')
  const [batchCover, setBatchCover] = useState<File | null>(null)

  const stats = useMemo(() => ({ artists: artists.length, albums: albums.length, genres: genres.filter(g => g.is_active).length, tracks: tracks.length, published: tracks.filter(t => t.status === 'published').length }), [artists, albums, genres, tracks])

  const loadData = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setNotice(null)

    try {
      const profileResult = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (profileResult.error) {
        throw new Error(`Erro ao carregar perfil administrativo: ${profileResult.error.message}`)
      }

      setProfile(profileResult.data as Profile | null)

      if (!profileResult.data) {
        throw new Error('O perfil desta conta não foi encontrado na tabela profiles.')
      }

      const [artistsResult, genresResult, albumsResult, tracksResult] = await Promise.all([
        supabase.from('artists').select('id, name').order('name'),
        supabase.from('genres').select('id, name, slug, description, is_active').order('name'),
        supabase.from('albums').select('id, title, artist_id').order('created_at', { ascending: false }),
        supabase.from('tracks').select('id, title, status, created_at, audio_path, cover_path, genre_id, artists(name)').order('created_at', { ascending: false }),
      ])

      if (artistsResult.error) throw new Error(`Erro ao carregar artistas: ${artistsResult.error.message}`)
      if (genresResult.error) throw new Error(`Erro ao carregar gêneros: ${genresResult.error.message}`)
      if (albumsResult.error) throw new Error(`Erro ao carregar álbuns: ${albumsResult.error.message}`)
      if (tracksResult.error) throw new Error(`Erro ao carregar músicas: ${tracksResult.error.message}`)

      setArtists((artistsResult.data || []) as Artist[])
      setGenres((genresResult.data || []) as Genre[])
      setAlbums((albumsResult.data || []) as AlbumRow[])
      setTracks((tracksResult.data || []) as unknown as TrackRow[])
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível carregar o painel administrativo.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [user])

  useEffect(() => {
    const channel = supabase.channel('studio-pro-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracks' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artists' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'albums' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'genres' }, () => void loadData())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user])

  const showError = (error: unknown) => setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Não foi possível concluir a operação.' })

  const createArtist = async (event: FormEvent) => {
    event.preventDefault(); if (!user || !artistName.trim()) return
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('artists').insert({ name: artistName.trim(), slug: slugify(artistName), biography: artistBio || null, created_by: user.id })
    if (error) showError(error); else { setNotice({ type: 'success', text: 'Artista cadastrado com sucesso.' }); setArtistName(''); setArtistBio(''); await loadData() }
    setSaving(false)
  }

  const createAlbum = async (event: FormEvent) => {
    event.preventDefault(); if (!user || !albumTitle.trim() || !albumArtist) return
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('albums').insert({ title: albumTitle.trim(), slug: slugify(albumTitle), artist_id: albumArtist, release_date: albumDate || null, created_by: user.id })
    if (error) showError(error); else { setNotice({ type: 'success', text: 'Álbum cadastrado com sucesso.' }); setAlbumTitle(''); setAlbumDate(''); await loadData() }
    setSaving(false)
  }

  const resetGenreForm = () => {
    setGenreName('')
    setGenreDescription('')
    setEditingGenreId(null)
  }

  const saveGenre = async (event: FormEvent) => {
    event.preventDefault()
    if (!genreName.trim()) return
    setSaving(true)
    setNotice(null)
    try {
      const payload = {
        name: genreName.trim(),
        slug: slugify(genreName),
        description: genreDescription.trim() || null,
        is_active: true,
      }

      const result = editingGenreId
        ? await supabase.from('genres').update(payload).eq('id', editingGenreId)
        : await supabase.from('genres').insert(payload)

      if (result.error) throw result.error
      setNotice({ type: 'success', text: editingGenreId ? 'Gênero atualizado com sucesso.' : 'Gênero cadastrado com sucesso.' })
      resetGenreForm()
      await loadData()
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  const startGenreEdit = (genre: Genre) => {
    setGenreName(genre.name)
    setGenreDescription(genre.description || '')
    setEditingGenreId(genre.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleGenre = async (genre: Genre) => {
    setSaving(true)
    setNotice(null)
    try {
      const { error } = await supabase.from('genres').update({ is_active: !genre.is_active }).eq('id', genre.id)
      if (error) throw error
      setNotice({ type: 'success', text: `Gênero ${genre.is_active ? 'desativado' : 'ativado'} com sucesso.` })
      await loadData()
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  const deleteGenre = async (genre: Genre) => {
    const linkedTracks = tracks.filter(track => track.genre_id === genre.id).length
    if (linkedTracks > 0) {
      setNotice({ type: 'error', text: `Não é possível excluir “${genre.name}” porque há ${linkedTracks} música(s) vinculada(s). Desative o gênero ou altere essas músicas primeiro.` })
      return
    }
    if (!window.confirm(`Excluir definitivamente o gênero “${genre.name}”?`)) return
    setSaving(true)
    setNotice(null)
    try {
      const { error } = await supabase.from('genres').delete().eq('id', genre.id)
      if (error) throw error
      setNotice({ type: 'success', text: `Gênero “${genre.name}” excluído com sucesso.` })
      if (editingGenreId === genre.id) resetGenreForm()
      await loadData()
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  const uploadFile = async (bucket: string, file: File, folder: string) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `${folder}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (error) throw error
    return path
  }

  const resetTrackForm = () => {
    setTrackTitle('')
    setTrackArtist('')
    setTrackAlbum('')
    setTrackGenre('')
    setTrackStatus('published')
    setTrackFeatured(false)
    setTrackDownload(false)
    setAudioFile(null)
    setCoverFile(null)

    const audioInput = document.getElementById('audio-file') as HTMLInputElement | null
    const coverInput = document.getElementById('cover-file') as HTMLInputElement | null
    if (audioInput) audioInput.value = ''
    if (coverInput) coverInput.value = ''
  }

  const createTrack = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (!user || !trackTitle.trim() || !trackArtist || !audioFile) {
      setNotice({ type: 'error', text: 'Informe título, artista e selecione o arquivo de áudio.' })
      return
    }

    setSaving(true)
    setNotice(null)
    let audioPath = ''
    let coverPath: string | null = null

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        throw new Error('Sua sessão de administrador expirou. Saia, entre novamente e repita o envio.')
      }

      audioPath = await uploadFile('music-audio', audioFile, user.id)
      if (coverFile) coverPath = await uploadFile('music-covers', coverFile, user.id)

      const { data: insertedTrack, error } = await supabase.from('tracks').insert({
        title: trackTitle.trim(),
        slug: slugify(trackTitle),
        artist_id: trackArtist,
        album_id: trackAlbum || null,
        genre_id: trackGenre || null,
        audio_path: audioPath,
        cover_path: coverPath,
        mime_type: audioFile.type,
        file_size_bytes: audioFile.size,
        status: trackStatus,
        is_featured: trackFeatured,
        is_downloadable: trackDownload,
        published_at: trackStatus === 'published' ? new Date().toISOString() : null,
        created_by: user.id,
      }).select('id, title, status, created_at, audio_path, cover_path, genre_id, artists(name)').single()

      if (error) throw error

      resetTrackForm()
      if (insertedTrack) {
        setTracks(currentTracks => [insertedTrack as unknown as TrackRow, ...currentTracks.filter(track => track.id !== insertedTrack.id)])
      }
      setNotice({ type: 'success', text: 'Música enviada com sucesso. O formulário já está pronto para o próximo cadastro.' })
    } catch (error) {
      if (audioPath) await supabase.storage.from('music-audio').remove([audioPath])
      if (coverPath) await supabase.storage.from('music-covers').remove([coverPath])
      showError(error)
    } finally {
      setSaving(false)
    }
  }


  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return '—'
    const minutes = Math.floor(seconds / 60)
    const remainder = String(seconds % 60).padStart(2, '0')
    return `${minutes}:${remainder}`
  }

  const selectBatchFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(file.name))
    if (!audioFiles.length) {
      setNotice({ type: 'error', text: 'Nenhum arquivo de áudio válido foi selecionado.' })
      return
    }

    setBatchReading(true)
    setNotice(null)
    try {
      const parsed = await Promise.all(audioFiles.map(async file => {
        const metadata = await readAudioMetadata(file)
        return {
          id: crypto.randomUUID(),
          file,
          ...metadata,
          selected: true,
          status: 'ready' as BatchStatus,
          error: null,
        }
      }))
      setBatchItems(parsed)
      setNotice({ type: 'success', text: `${parsed.length} arquivo(s) lido(s). Revise as informações antes de importar.` })
    } catch (error) {
      showError(error)
    } finally {
      setBatchReading(false)
    }
  }

  const updateBatchItem = (id: string, changes: Partial<BatchItem>) => {
    setBatchItems(items => items.map(item => item.id === id ? { ...item, ...changes } : item))
  }

  const applyBatchDefaults = () => {
    const artistName = artists.find(a => a.id === batchDefaultArtist)?.name || ''
    const albumName = albums.find(a => a.id === batchDefaultAlbum)?.title || ''
    const genreName = genres.find(g => g.id === batchDefaultGenre)?.name || ''
    setBatchItems(items => items.map(item => ({
      ...item,
      artist: artistName || item.artist,
      album: albumName || item.album,
      genre: genreName || item.genre,
      coverFile: batchCover || item.coverFile,
    })))
    setNotice({ type: 'success', text: 'Dados padrão aplicados ao lote.' })
  }

  const ensureArtist = async (name: string) => {
    const normalized = name.trim()
    if (!normalized) throw new Error('Artista não informado.')
    const existing = artists.find(item => item.name.localeCompare(normalized, undefined, { sensitivity: 'accent' }) === 0)
    if (existing) return existing.id
    const { data, error } = await supabase.from('artists').insert({ name: normalized, slug: `${slugify(normalized)}-${crypto.randomUUID().slice(0, 6)}`, created_by: user?.id }).select('id, name').single()
    if (error) throw error
    setArtists(current => [...current, data as Artist].sort((a, b) => a.name.localeCompare(b.name)))
    return data.id as string
  }

  const ensureGenre = async (name: string) => {
    const normalized = name.trim()
    if (!normalized) return null
    const existing = genres.find(item => item.name.localeCompare(normalized, undefined, { sensitivity: 'accent' }) === 0)
    if (existing) return existing.id
    const { data, error } = await supabase.from('genres').insert({ name: normalized, slug: `${slugify(normalized)}-${crypto.randomUUID().slice(0, 6)}`, is_active: true }).select('id, name, slug, description, is_active').single()
    if (error) throw error
    setGenres(current => [...current, data as Genre].sort((a, b) => a.name.localeCompare(b.name)))
    return data.id as string
  }

  const ensureAlbum = async (title: string, artistId: string, year: string) => {
    const normalized = title.trim()
    if (!normalized) return null
    const existing = albums.find(item => item.artist_id === artistId && item.title.localeCompare(normalized, undefined, { sensitivity: 'accent' }) === 0)
    if (existing) return existing.id
    const releaseDate = /^\d{4}$/.test(year.trim()) ? `${year.trim()}-01-01` : null
    const { data, error } = await supabase.from('albums').insert({ title: normalized, slug: `${slugify(normalized)}-${crypto.randomUUID().slice(0, 6)}`, artist_id: artistId, release_date: releaseDate, created_by: user?.id }).select('id, title, artist_id').single()
    if (error) throw error
    setAlbums(current => [data as AlbumRow, ...current])
    return data.id as string
  }

  const importBatch = async () => {
    if (!user || batchUploading) return
    const selected = batchItems.filter(item => item.selected && item.status !== 'success')
    if (!selected.length) {
      setNotice({ type: 'error', text: 'Selecione pelo menos uma música para importar.' })
      return
    }
    if (selected.some(item => !item.title.trim() || !item.artist.trim())) {
      setNotice({ type: 'error', text: 'Revise o lote: todas as músicas precisam de título e artista.' })
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setNotice({ type: 'error', text: 'Sua sessão expirou. Entre novamente antes de importar o lote.' })
      return
    }

    setBatchUploading(true)
    setBatchProgress(0)
    setNotice(null)
    let completed = 0
    let failures = 0

    for (const item of selected) {
      updateBatchItem(item.id, { status: 'uploading', error: null })
      let audioPath = ''
      let coverPath: string | null = null
      try {
        const artistId = await ensureArtist(item.artist)
        const albumId = await ensureAlbum(item.album, artistId, item.year)
        const genreId = await ensureGenre(item.genre)
        audioPath = await uploadFile('music-audio', item.file, user.id)
        const itemCover = item.coverFile || batchCover
        if (itemCover) coverPath = await uploadFile('music-covers', itemCover, user.id)

        const { error } = await supabase.from('tracks').insert({
          title: item.title.trim(),
          slug: `${slugify(item.title)}-${crypto.randomUUID().slice(0, 6)}`,
          artist_id: artistId,
          album_id: albumId,
          genre_id: genreId,
          audio_path: audioPath,
          cover_path: coverPath,
          mime_type: item.file.type || 'audio/mpeg',
          file_size_bytes: item.file.size,
          duration_seconds: item.durationSeconds,
          track_number: Number.parseInt(item.trackNumber, 10) || null,
          status: 'published',
          is_featured: false,
          is_downloadable: true,
          published_at: new Date().toISOString(),
          created_by: user.id,
        })
        if (error) throw error
        completed++
        updateBatchItem(item.id, { status: 'success' })
      } catch (error) {
        failures++
        if (audioPath) await supabase.storage.from('music-audio').remove([audioPath])
        if (coverPath) await supabase.storage.from('music-covers').remove([coverPath])
        updateBatchItem(item.id, { status: 'error', error: error instanceof Error ? error.message : 'Falha no envio.' })
      }
      setBatchProgress(Math.round(((completed + failures) / selected.length) * 100))
    }

    setBatchUploading(false)
    await loadData()
    setNotice({
      type: failures ? 'error' : 'success',
      text: failures ? `${completed} música(s) importada(s) e ${failures} com erro. Revise as linhas destacadas.` : `${completed} música(s) importada(s) com sucesso.`,
    })
  }


  const deleteTrack = async (track: TrackRow) => {
    const confirmed = window.confirm(`Excluir definitivamente a música “${track.title}”? Esta ação também removerá o áudio e a capa do Storage.`)
    if (!confirmed) return

    setSaving(true)
    setNotice(null)
    try {
      const { error: deleteError } = await supabase.from('tracks').delete().eq('id', track.id)
      if (deleteError) throw deleteError

      const removals: PromiseLike<unknown>[] = []
      if (track.audio_path) removals.push(supabase.storage.from('music-audio').remove([track.audio_path]))
      if (track.cover_path) removals.push(supabase.storage.from('music-covers').remove([track.cover_path]))
      await Promise.allSettled(removals)

      setNotice({ type: 'success', text: `Música “${track.title}” excluída com sucesso.` })
      await loadData()
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="studio-loading"><Loader2 className="spin" /> Carregando LIVE MUSIC Studio Pro...</div>
  if (!profile) return <div className="studio-loading"><div><h2>Não foi possível carregar o perfil</h2><p>{notice?.text || 'O perfil desta conta não foi encontrado no banco de dados.'}</p><Link to="/" className="studio-back"><ArrowLeft /> Voltar ao aplicativo</Link></div></div>
  if (profile.role !== 'admin') return <div className="studio-loading"><div><h2>Acesso não autorizado</h2><p>Esta conta está cadastrada como: <strong>{profile.role || 'sem função definida'}</strong>.</p><Link to="/" className="studio-back"><ArrowLeft /> Voltar ao aplicativo</Link></div></div>

  return <div className="studio-shell">
    <aside className="studio-sidebar">
      <div><span className="studio-version">LIVE MUSIC</span><h1>Studio</h1><p>Gestão do catálogo e streaming</p></div>
      <nav>
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}><Disc3 /> Dashboard</button>
        <button className={activeTab === 'artist' ? 'active' : ''} onClick={() => setActiveTab('artist')}><UserRound /> Novo artista</button>
        <button className={activeTab === 'album' ? 'active' : ''} onClick={() => setActiveTab('album')}><Album /> Novo álbum</button>
        <button className={activeTab === 'genre' ? 'active' : ''} onClick={() => setActiveTab('genre')}><Tags /> Gêneros</button>
        <button className={activeTab === 'track' ? 'active' : ''} onClick={() => setActiveTab('track')}><Music2 /> Enviar música</button>
        <button className={activeTab === 'batch' ? 'active' : ''} onClick={() => setActiveTab('batch')}><FolderOpen /> Upload em lote</button>
      </nav>
      <Link to="/" className="studio-back"><ArrowLeft /> Voltar ao aplicativo</Link>
    </aside>

    <main className="studio-main">
      <header className="studio-header"><div><span className="eyebrow">V3.5 • UPLOAD EM LOTE</span><h2>{activeTab === 'dashboard' ? 'Visão geral do catálogo' : activeTab === 'artist' ? 'Cadastrar artista' : activeTab === 'album' ? 'Cadastrar álbum' : activeTab === 'genre' ? 'Gerenciar gêneros musicais' : activeTab === 'batch' ? 'Importar várias músicas com metadados' : 'Enviar música para o streaming'}</h2></div><span className="admin-badge">Administrador</span></header>
      {notice && <div className={`studio-notice ${notice.type}`}>{notice.type === 'success' && <CheckCircle2 />} {notice.text}</div>}

      {activeTab === 'dashboard' && <>
        <section className="studio-stats">
          <article><UserRound /><span>Artistas</span><strong>{stats.artists}</strong></article>
          <article><Album /><span>Álbuns</span><strong>{stats.albums}</strong></article>
          <article><Tags /><span>Gêneros ativos</span><strong>{stats.genres}</strong></article>
          <article><Music2 /><span>Músicas</span><strong>{stats.tracks}</strong></article>
          <article><CheckCircle2 /><span>Publicadas</span><strong>{stats.published}</strong></article>
        </section>
        <section className="studio-panel"><div className="studio-panel-head"><div><span className="eyebrow">ÚLTIMOS UPLOADS</span><h3>Catálogo recente</h3></div><button className="primary-button" onClick={() => setActiveTab('track')}><Plus /> Nova música</button></div>
          <div className="studio-table">
            {tracks.length ? tracks.map(track => <div className="studio-row" key={track.id}><div className="studio-track-icon"><Music2 /></div><div><strong>{track.title}</strong><span>{(Array.isArray(track.artists) ? track.artists[0]?.name : track.artists?.name) || 'Artista não informado'}</span></div><span className={`status-pill ${track.status}`}>{track.status === 'published' ? 'Publicada' : 'Rascunho'}</span><time>{new Date(track.created_at).toLocaleDateString('pt-BR')}</time><button className="studio-delete-button" disabled={saving} title="Excluir música" onClick={() => void deleteTrack(track)}><Trash2 size={18}/><span>Excluir</span></button></div>) : <div className="studio-empty">Nenhuma música cadastrada ainda.</div>}
          </div>
        </section>
      </>}

      {activeTab === 'artist' && <form className="studio-form studio-panel" onSubmit={createArtist}><label>Nome do artista<input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Ex.: Luna Vale" required /></label><label>Biografia<textarea value={artistBio} onChange={e => setArtistBio(e.target.value)} placeholder="Apresentação do artista" rows={6} /></label><button disabled={saving} className="primary-button" type="submit">{saving ? <Loader2 className="spin" /> : <Plus />} Cadastrar artista</button></form>}

      {activeTab === 'album' && <form className="studio-form studio-panel" onSubmit={createAlbum}><div className="form-grid"><label>Título do álbum<input value={albumTitle} onChange={e => setAlbumTitle(e.target.value)} required /></label><label>Artista<select value={albumArtist} onChange={e => setAlbumArtist(e.target.value)} required><option value="">Selecione</option>{artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Data de lançamento<input type="date" value={albumDate} onChange={e => setAlbumDate(e.target.value)} /></label></div><button disabled={saving} className="primary-button" type="submit">{saving ? <Loader2 className="spin" /> : <Plus />} Cadastrar álbum</button></form>}


      {activeTab === 'genre' && <div className="genre-admin-grid">
        <form className="studio-form studio-panel" onSubmit={saveGenre}>
          <div className="studio-panel-head"><div><span className="eyebrow">{editingGenreId ? 'EDITAR GÊNERO' : 'NOVO GÊNERO'}</span><h3>{editingGenreId ? 'Atualize os dados do gênero' : 'Cadastre um gênero musical'}</h3></div>{editingGenreId && <button type="button" className="studio-secondary-button" onClick={resetGenreForm}><X size={17}/> Cancelar</button>}</div>
          <label>Nome do gênero<input value={genreName} onChange={e => setGenreName(e.target.value)} placeholder="Ex.: Forró, Gospel, Samba" required /></label>
          <label>Descrição<textarea value={genreDescription} onChange={e => setGenreDescription(e.target.value)} placeholder="Uma breve apresentação do gênero" rows={5} /></label>
          <button disabled={saving} className="primary-button" type="submit">{saving ? <Loader2 className="spin" /> : editingGenreId ? <Save /> : <Plus />} {editingGenreId ? 'Salvar alterações' : 'Cadastrar gênero'}</button>
        </form>

        <section className="studio-panel genre-list-panel">
          <div className="studio-panel-head"><div><span className="eyebrow">CATÁLOGO DE GÊNEROS</span><h3>{genres.length} gêneros cadastrados</h3></div></div>
          <div className="genre-admin-list">
            {genres.length ? genres.map(genre => {
              const linkedTracks = tracks.filter(track => track.genre_id === genre.id).length
              return <article className={`genre-admin-item ${genre.is_active ? '' : 'inactive'}`} key={genre.id}>
                <div className="genre-admin-icon"><Tags /></div>
                <div className="genre-admin-info"><strong>{genre.name}</strong><span>{genre.description || 'Sem descrição'}</span><small>{linkedTracks} música(s) vinculada(s) • {genre.is_active ? 'Ativo' : 'Inativo'}</small></div>
                <div className="genre-admin-actions">
                  <button type="button" className="studio-icon-button" title="Editar gênero" onClick={() => startGenreEdit(genre)}><Pencil size={17}/></button>
                  <button type="button" className="studio-toggle-button" disabled={saving} onClick={() => void toggleGenre(genre)}>{genre.is_active ? 'Desativar' : 'Ativar'}</button>
                  <button type="button" className="studio-delete-button" disabled={saving || linkedTracks > 0} title={linkedTracks > 0 ? 'Existem músicas vinculadas' : 'Excluir gênero'} onClick={() => void deleteGenre(genre)}><Trash2 size={17}/><span>Excluir</span></button>
                </div>
              </article>
            }) : <div className="studio-empty">Nenhum gênero cadastrado.</div>}
          </div>
        </section>
      </div>}

      {activeTab === 'track' && <form className="studio-form studio-panel" onSubmit={createTrack}>
        <div className="upload-grid"><label className="upload-zone"><UploadCloud /><strong>Arquivo de áudio</strong><span>{audioFile?.name || 'MP3, WAV, FLAC ou M4A'}</span><input id="audio-file" type="file" accept="audio/mpeg,audio/wav,audio/flac,audio/mp4,audio/x-m4a" onChange={e => setAudioFile(e.target.files?.[0] || null)} required /></label><label className="upload-zone"><UploadCloud /><strong>Capa da música</strong><span>{coverFile?.name || 'JPG, PNG, WebP ou AVIF'}</span><input id="cover-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => setCoverFile(e.target.files?.[0] || null)} /></label></div>
        <div className="form-grid"><label>Título<input value={trackTitle} onChange={e => setTrackTitle(e.target.value)} required /></label><label>Artista<select value={trackArtist} onChange={e => { setTrackArtist(e.target.value); setTrackAlbum('') }} required><option value="">Selecione</option>{artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Álbum<select value={trackAlbum} onChange={e => setTrackAlbum(e.target.value)}><option value="">Single / sem álbum</option>{albums.filter(a => !trackArtist || a.artist_id === trackArtist).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label><label>Gênero<select value={trackGenre} onChange={e => setTrackGenre(e.target.value)}><option value="">Selecione</option>{genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label>Status<select value={trackStatus} onChange={e => setTrackStatus(e.target.value as 'draft' | 'published')}><option value="published">Publicada</option><option value="draft">Rascunho</option></select></label></div>
        <div className="studio-checks"><label><input type="checkbox" checked={trackFeatured} onChange={e => setTrackFeatured(e.target.checked)} /> Música em destaque</label><label><input type="checkbox" checked={trackDownload} onChange={e => setTrackDownload(e.target.checked)} /> Download permitido</label></div>
        <button disabled={saving} className="primary-button upload-submit" type="submit">{saving ? <><Loader2 className="spin" /> Enviando...</> : <><UploadCloud /> Enviar e cadastrar música</>}</button>
      </form>}

      {activeTab === 'batch' && <div className="batch-workspace">
        <section className="studio-panel batch-intro">
          <div className="studio-panel-head"><div><span className="eyebrow">IMPORTAÇÃO INTELIGENTE</span><h3>Selecione várias músicas de uma vez</h3><p>O sistema lê título, artista, álbum, gênero, faixa, ano, duração e capa incorporada quando os metadados ID3 estiverem disponíveis.</p></div></div>
          <label className="upload-zone batch-drop-zone"><FolderOpen /><strong>{batchReading ? 'Lendo metadados...' : 'Selecionar várias músicas'}</strong><span>MP3, WAV, FLAC, M4A, AAC ou OGG</span><input type="file" multiple accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg" onChange={event => void selectBatchFiles(event.target.files)} disabled={batchReading || batchUploading} /></label>
        </section>

        {batchItems.length > 0 && <>
          <section className="studio-panel batch-defaults">
            <div className="studio-panel-head"><div><span className="eyebrow">DADOS PADRÃO</span><h3>Preencha somente o que estiver faltando</h3></div><button type="button" className="studio-secondary-button" onClick={applyBatchDefaults}><RefreshCw size={17}/> Aplicar ao lote</button></div>
            <div className="form-grid">
              <label>Artista existente<select value={batchDefaultArtist} onChange={e => { setBatchDefaultArtist(e.target.value); setBatchDefaultAlbum('') }}><option value="">Não alterar</option>{artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label>Álbum existente<select value={batchDefaultAlbum} onChange={e => setBatchDefaultAlbum(e.target.value)}><option value="">Não alterar</option>{albums.filter(a => !batchDefaultArtist || a.artist_id === batchDefaultArtist).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
              <label>Gênero existente<select value={batchDefaultGenre} onChange={e => setBatchDefaultGenre(e.target.value)}><option value="">Não alterar</option>{genres.filter(g => g.is_active).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
              <label>Capa para o lote<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => setBatchCover(e.target.files?.[0] || null)} /></label>
            </div>
          </section>

          <section className="studio-panel batch-review">
            <div className="studio-panel-head"><div><span className="eyebrow">REVISÃO</span><h3>{batchItems.length} música(s) selecionada(s)</h3></div><button type="button" className="studio-secondary-button" disabled={batchUploading} onClick={() => setBatchItems([])}><X size={17}/> Limpar lote</button></div>
            <div className="batch-table-wrap"><table className="batch-table"><thead><tr><th>Importar</th><th>Arquivo / duração</th><th>Título</th><th>Artista</th><th>Álbum</th><th>Gênero</th><th>Faixa</th><th>Status</th></tr></thead><tbody>{batchItems.map(item => <tr key={item.id} className={`batch-row-${item.status}`}>
              <td><input type="checkbox" checked={item.selected} disabled={batchUploading || item.status === 'success'} onChange={e => updateBatchItem(item.id, { selected: e.target.checked })} /></td>
              <td><div className="batch-file-cell"><FileAudio size={18}/><span><strong>{item.file.name}</strong><small>{formatDuration(item.durationSeconds)} • {(item.file.size / 1024 / 1024).toFixed(1)} MB {item.coverFile ? '• capa ID3' : ''}</small></span></div></td>
              <td><input value={item.title} disabled={batchUploading || item.status === 'success'} onChange={e => updateBatchItem(item.id, { title: e.target.value })} /></td>
              <td><input value={item.artist} disabled={batchUploading || item.status === 'success'} placeholder="Obrigatório" onChange={e => updateBatchItem(item.id, { artist: e.target.value })} /></td>
              <td><input value={item.album} disabled={batchUploading || item.status === 'success'} placeholder="Single" onChange={e => updateBatchItem(item.id, { album: e.target.value })} /></td>
              <td><input value={item.genre} disabled={batchUploading || item.status === 'success'} onChange={e => updateBatchItem(item.id, { genre: e.target.value })} /></td>
              <td><input className="batch-track-number" value={item.trackNumber} disabled={batchUploading || item.status === 'success'} onChange={e => updateBatchItem(item.id, { trackNumber: e.target.value })} /></td>
              <td><span className={`batch-status ${item.status}`}>{item.status === 'ready' ? 'Pronta' : item.status === 'uploading' ? 'Enviando' : item.status === 'success' ? 'Concluída' : 'Erro'}</span>{item.error && <small className="batch-error">{item.error}</small>}</td>
            </tr>)}</tbody></table></div>
            {batchUploading && <div className="batch-progress"><div style={{ width: `${batchProgress}%` }} /><span>{batchProgress}%</span></div>}
            <button type="button" className="primary-button upload-submit" disabled={batchUploading || !batchItems.some(item => item.selected && item.status !== 'success')} onClick={() => void importBatch()}>{batchUploading ? <><Loader2 className="spin"/> Importando {batchProgress}%</> : <><UploadCloud/> Importar músicas selecionadas</>}</button>
          </section>
        </>}
      </div>}
    <footer className="studio-institutional-footer">LIVE MUSIC Studio Pro • Versão 3.5.7 • © 2026 • Desenvolvido por <strong>Cristiano Lucas dos Santos</strong> • Todos os direitos reservados.</footer>
</main>
  </div>
}
