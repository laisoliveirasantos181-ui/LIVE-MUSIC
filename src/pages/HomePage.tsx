import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, ChevronLeft, ChevronRight, Compass, Disc3, Download, Heart, Home,
  Library, ListMusic, LogOut, Menu, MoreHorizontal, Pause, Play, Radio,
  Repeat, Repeat1, Search, Settings, Shuffle, SkipBack, SkipForward,
  SlidersHorizontal, Sparkles, Users, Volume2, VolumeX, X, Plus, Trash2, RefreshCw
} from 'lucide-react'
import { Brand } from '../components/Brand'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type Profile = {
  full_name: string | null
  role: 'admin' | 'user'
  plan: 'free' | 'premium'
  avatar_url: string | null
}

type RelationName = { name?: string | null } | { name?: string | null }[] | null
type RelationTitle = { title?: string | null } | { title?: string | null }[] | null

type TrackRow = {
  id: string
  title: string
  audio_path: string
  cover_path: string | null
  duration_seconds: number | null
  is_featureured?: boolean | null
  is_featured: boolean | null
  is_downloadable: boolean | null
  play_count: number | null
  artists: RelationName
  albums: RelationTitle
  genres: RelationName
}

type Track = {
  id: string
  title: string
  artist: string
  album: string
  genre: string
  durationSeconds: number
  coverUrl: string | null
  audioUrl: string
  audioPath: string
  featured: boolean
  downloadable: boolean
  playCount: number
}

type RepeatMode = 'off' | 'all' | 'one'

type Playlist = {
  id: string
  title: string
  description: string | null
  trackIds: string[]
  createdAt: string
}

type PlayerSnapshot = {
  trackId: string | null
  currentTime: number
  wasPlaying: boolean
  volume: number
  shuffleEnabled: boolean
  repeatMode: RepeatMode
}

const PLAYER_STORAGE_KEY = 'live-music-player-v351'

const readPlayerSnapshot = (): PlayerSnapshot => {
  const fallback: PlayerSnapshot = { trackId: null, currentTime: 0, wasPlaying: false, volume: .72, shuffleEnabled: false, repeatMode: 'off' }
  try {
    const raw = window.localStorage.getItem(PLAYER_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PlayerSnapshot>
    return {
      trackId: typeof parsed.trackId === 'string' ? parsed.trackId : null,
      currentTime: typeof parsed.currentTime === 'number' && Number.isFinite(parsed.currentTime) ? Math.max(0, parsed.currentTime) : 0,
      wasPlaying: Boolean(parsed.wasPlaying),
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : .72,
      shuffleEnabled: Boolean(parsed.shuffleEnabled),
      repeatMode: parsed.repeatMode === 'all' || parsed.repeatMode === 'one' ? parsed.repeatMode : 'off',
    }
  } catch {
    return fallback
  }
}

const nav = [
  { label: 'Início', icon: Home }, { label: 'Descobrir', icon: Compass }, { label: 'Músicas', icon: Disc3 },
  { label: 'Álbuns', icon: Library }, { label: 'Playlists', icon: ListMusic }, { label: 'Favoritos', icon: Heart },
  { label: 'Downloads', icon: Download }, { label: 'Rádio ao vivo', icon: Radio },
]

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

const firstRelationValue = <T extends Record<string, unknown>>(relation: T | T[] | null | undefined, key: keyof T) => {
  const item = Array.isArray(relation) ? relation[0] : relation
  const value = item?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

const safeFilename = (value: string) => value.replace(/[\\/:*?"<>|]+/g, '').trim() || 'musica'

const probeAudioDuration = (url: string) => new Promise<number>((resolve) => {
  const audio = document.createElement('audio')
  let settled = false
  const finish = (value: number) => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    audio.removeAttribute('src')
    audio.load()
    resolve(value)
  }
  const read = () => {
    const value = audio.duration
    if (Number.isFinite(value) && value > 0) finish(Math.round(value))
  }
  const timeout = window.setTimeout(() => finish(0), 12000)
  audio.preload = 'metadata'
  audio.onloadedmetadata = read
  audio.ondurationchange = read
  audio.onerror = () => finish(0)
  audio.src = url
  audio.load()
})

export function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [toast, setToast] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('Início')
  const [query, setQuery] = useState('')
  const initialPlayerRef = useRef<PlayerSnapshot>(readPlayerSnapshot())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(initialPlayerRef.current.currentTime)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(initialPlayerRef.current.volume)
  const [shuffleEnabled, setShuffleEnabled] = useState(initialPlayerRef.current.shuffleEnabled)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(initialPlayerRef.current.repeatMode)
  const [favorites, setFavorites] = useState<string[]>([])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistBusy, setPlaylistBusy] = useState(false)
  const [catalogRefreshing, setCatalogRefreshing] = useState(false)
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string | null>(null)
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [queueTrackIds, setQueueTrackIds] = useState<string[]>([])
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const tracksRef = useRef<Track[]>([])
  const currentTrackIdRef = useRef<string | null>(null)
  const shouldAutoplayRef = useRef(false)
  const playCountedTrackRef = useRef<string | null>(null)
  const restoredTrackRef = useRef(false)
  const lastPersistedSecondRef = useRef(-1)
  const current = tracks[currentIndex] ?? null

  useEffect(() => { tracksRef.current = tracks }, [tracks])
  useEffect(() => { currentTrackIdRef.current = current?.id ?? null }, [current?.id])

  useEffect(() => {
    if (!user) return
    void supabase
      .from('profiles')
      .select('full_name, role, plan, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null))
  }, [user])

  useEffect(() => {
    if (!user) return
    void supabase.from('user_favorites').select('track_id').eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!error) setFavorites((data || []).map(item => item.track_id as string))
      })
  }, [user])

  const loadCatalog = useCallback(async (silent = false) => {
    if (!silent) setCatalogLoading(true)
    else setCatalogRefreshing(true)
    setCatalogError('')

    const { data, error } = await supabase
      .from('tracks')
      .select(`
        id, title, audio_path, cover_path, duration_seconds,
        is_featured, is_downloadable, play_count,
        artists(name), albums(title), genres(name)
      `)
      .eq('status', 'published')
      .order('is_featured', { ascending: false })
      .order('published_at', { ascending: false })

    if (error) {
      setCatalogError(`Não foi possível carregar o catálogo: ${error.message}`)
      setCatalogLoading(false)
      setCatalogRefreshing(false)
      return
    }

    const previousById = new Map(tracksRef.current.map(track => [track.id, track]))
    const rows = (data || []) as unknown as TrackRow[]
    const hydrated = await Promise.all(rows.map(async row => {
      const previous = previousById.get(row.id)
      let audioUrl = previous?.audioPath === row.audio_path ? previous.audioUrl : ''
      if (!audioUrl) {
        const { data: signed, error: signedError } = await supabase.storage
          .from('music-audio')
          .createSignedUrl(row.audio_path, 60 * 60 * 6)
        if (signedError || !signed?.signedUrl) return null
        audioUrl = signed.signedUrl
      }

      const coverUrl = row.cover_path
        ? supabase.storage.from('music-covers').getPublicUrl(row.cover_path).data.publicUrl
        : null

      return {
        id: row.id,
        title: row.title,
        artist: firstRelationValue(row.artists as Record<string, unknown> | Record<string, unknown>[] | null, 'name') || 'Artista não informado',
        album: firstRelationValue(row.albums as Record<string, unknown> | Record<string, unknown>[] | null, 'title') || 'Single',
        genre: firstRelationValue(row.genres as Record<string, unknown> | Record<string, unknown>[] | null, 'name') || 'Sem gênero',
        durationSeconds: row.duration_seconds || previous?.durationSeconds || 0,
        coverUrl,
        audioUrl,
        audioPath: row.audio_path,
        featured: Boolean(row.is_featured),
        downloadable: Boolean(row.is_downloadable),
        playCount: row.play_count || 0,
      } satisfies Track
    }))

    const availableTracks = hydrated.filter((track): track is Track => track !== null)
    const activeId = currentTrackIdRef.current || initialPlayerRef.current.trackId
    setTracks(availableTracks)
    if (activeId) {
      const restoredIndex = availableTracks.findIndex(track => track.id === activeId)
      if (restoredIndex >= 0) setCurrentIndex(restoredIndex)
      else if (availableTracks.length) setCurrentIndex(0)
    } else if (availableTracks.length) {
      setCurrentIndex(0)
    }
    setCatalogLoading(false)
    setCatalogRefreshing(false)
  }, [])

  const loadPlaylists = useCallback(async () => {
    if (!user) return
    const { data: playlistRows, error } = await supabase
      .from('playlists')
      .select('id, title, description, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      setToast(`Não foi possível carregar playlists: ${error.message}`)
      return
    }
    const ids = (playlistRows || []).map(row => row.id as string)
    let links: { playlist_id: string; track_id: string }[] = []
    if (ids.length) {
      const { data: linkRows, error: linkError } = await supabase
        .from('playlist_tracks')
        .select('playlist_id, track_id')
        .in('playlist_id', ids)
        .order('position', { ascending: true })
      if (linkError) {
        setToast(`Não foi possível carregar músicas das playlists: ${linkError.message}`)
        return
      }
      links = (linkRows || []) as { playlist_id: string; track_id: string }[]
    }
    setPlaylists((playlistRows || []).map(row => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
      createdAt: row.created_at as string,
      trackIds: links.filter(link => link.playlist_id === row.id).map(link => link.track_id),
    })))
  }, [user?.id])

  useEffect(() => { void loadCatalog() }, [])
  useEffect(() => { void loadPlaylists() }, [loadPlaylists])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadCatalog(true)
        void loadPlaylists()
      }
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    const channel = supabase.channel('live-music-catalog-v342')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracks' }, () => void loadCatalog(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, () => void loadPlaylists())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_tracks' }, () => void loadPlaylists())
      .subscribe()

    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      void supabase.removeChannel(channel)
    }
  }, [loadCatalog, loadPlaylists])

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])

  useEffect(() => {
    const missing = tracks.filter(track => track.durationSeconds <= 0)
    if (!missing.length) return
    let cancelled = false

    const repairDurations = async () => {
      for (const track of missing) {
        if (cancelled) return
        const value = await probeAudioDuration(track.audioUrl)
        if (cancelled || value <= 0) continue
        setTracks(items => items.map(item => item.id === track.id ? { ...item, durationSeconds: value } : item))
        await supabase.from('tracks').update({ duration_seconds: value }).eq('id', track.id)
      }
    }

    void repairDurations()
    return () => { cancelled = true }
  }, [tracks.map(track => `${track.id}:${track.durationSeconds}`).join('|')])

  const registerPlay = useCallback(async (track: Track) => {
    if (playCountedTrackRef.current === track.id) return
    playCountedTrackRef.current = track.id
    setTracks(items => items.map(item => item.id === track.id ? { ...item, playCount: item.playCount + 1 } : item))
    await Promise.allSettled([
      supabase.rpc('increment_track_play_count', { p_track_id: track.id }),
      user ? supabase.from('listening_history').insert({ user_id: user.id, track_id: track.id, listened_seconds: 0, completed: false }) : Promise.resolve(),
    ])
  }, [user?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return

    const isInitialRestore = !restoredTrackRef.current && initialPlayerRef.current.trackId === current.id
    const savedTime = isInitialRestore ? initialPlayerRef.current.currentTime : 0
    const shouldResume = isInitialRestore ? initialPlayerRef.current.wasPlaying : shouldAutoplayRef.current

    restoredTrackRef.current = true
    setProgress(savedTime)
    setDuration(current.durationSeconds)
    playCountedTrackRef.current = null
    audio.load()

    const prepare = () => {
      if (savedTime > 0 && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(savedTime, Math.max(0, audio.duration - .25))
      }
      if (shouldResume) {
        void audio.play().then(() => {
          setPlaying(true)
          void registerPlay(current)
        }).catch(() => setPlaying(false))
      }
    }

    if (audio.readyState >= 1) prepare()
    else audio.addEventListener('loadedmetadata', prepare, { once: true })
  }, [current?.id])

  useEffect(() => {
    if (!current) return
    const wholeSecond = Math.floor(progress)
    if (wholeSecond === lastPersistedSecondRef.current && playing) return
    lastPersistedSecondRef.current = wholeSecond
    const snapshot: PlayerSnapshot = {
      trackId: current.id,
      currentTime: progress,
      wasPlaying: playing,
      volume,
      shuffleEnabled,
      repeatMode,
    }
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(snapshot))
  }, [current?.id, progress, playing, volume, shuffleEnabled, repeatMode])

  useEffect(() => {
    const persistBeforeLeaving = () => {
      if (!current) return
      const currentTime = audioRef.current?.currentTime ?? progress
      const snapshot: PlayerSnapshot = { trackId: current.id, currentTime, wasPlaying: Boolean(audioRef.current && !audioRef.current.paused), volume, shuffleEnabled, repeatMode }
      window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(snapshot))
    }
    window.addEventListener('pagehide', persistBeforeLeaving)
    return () => window.removeEventListener('pagehide', persistBeforeLeaving)
  }, [current?.id, progress, volume, shuffleEnabled, repeatMode])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const displayName = useMemo(() => profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ouvinte', [profile, user])
  const visibleTracks = useMemo(() => {
    let list = tracks
    if (activeNav === 'Favoritos') list = tracks.filter(track => favorites.includes(track.id))
    if (activeNav === 'Downloads') list = tracks.filter(track => track.downloadable)
    if (activeNav === 'Álbuns') list = [...tracks].sort((a, b) => a.album.localeCompare(b.album))
    if (activeNav === 'Descobrir') list = [...tracks].sort((a, b) => b.playCount - a.playCount)
    if (query.trim()) {
      const term = query.toLowerCase()
      list = list.filter(track => [track.title, track.artist, track.album, track.genre].some(value => value.toLowerCase().includes(term)))
    }
    return list
  }, [tracks, query, activeNav, favorites])

  const albumGroups = useMemo(() => {
    const groups = new Map<string, Track[]>()
    visibleTracks.forEach(track => {
      const key = track.album || 'Single'
      groups.set(key, [...(groups.get(key) || []), track])
    })
    return Array.from(groups.entries()).map(([title, albumTracks]) => ({
      key: `${albumTracks[0]?.artist || 'Artista'}::${title}`,
      title,
      artist: albumTracks[0]?.artist || 'Artista não informado',
      coverUrl: albumTracks.find(track => track.coverUrl)?.coverUrl || null,
      tracks: albumTracks,
    }))
  }, [visibleTracks])

  const selectedAlbum = useMemo(
    () => albumGroups.find(album => album.key === selectedAlbumKey) || null,
    [albumGroups, selectedAlbumKey],
  )

  const genreGroups = useMemo(() => {
    const groups = new Map<string, Track[]>()
    tracks.forEach(track => {
      const key = track.genre || 'Sem gênero'
      groups.set(key, [...(groups.get(key) || []), track])
    })
    return Array.from(groups.entries())
      .map(([name, genreTracks]) => ({ name, tracks: genreTracks }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [tracks])

  const selectedGenreTracks = useMemo(
    () => selectedGenre ? tracks.filter(track => track.genre === selectedGenre) : [],
    [tracks, selectedGenre],
  )

  const selectedPlaylist = useMemo(
    () => playlists.find(playlist => playlist.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId],
  )

  const selectedPlaylistTracks = useMemo(
    () => selectedPlaylist ? selectedPlaylist.trackIds.map(id => tracks.find(track => track.id === id)).filter((track): track is Track => Boolean(track)) : [],
    [selectedPlaylist, tracks],
  )

  const createPlaylist = async () => {
    if (!user || !playlistName.trim()) return
    setPlaylistBusy(true)
    const { error } = await supabase.from('playlists').insert({
      owner_id: user.id,
      created_by: user.id,
      title: playlistName.trim(),
      is_public: false,
      is_editorial: false,
    })
    setPlaylistBusy(false)
    if (error) {
      setToast(`Não foi possível criar a playlist: ${error.message}`)
      return
    }
    setPlaylistName('')
    setToast('Playlist criada com sucesso.')
    await loadPlaylists()
  }

  const deletePlaylist = async (playlistId: string) => {
    if (!window.confirm('Excluir esta playlist?')) return
    const { error } = await supabase.from('playlists').delete().eq('id', playlistId)
    if (error) {
      setToast(`Não foi possível excluir a playlist: ${error.message}`)
      return
    }
    if (selectedPlaylistId === playlistId) setSelectedPlaylistId(null)
    setToast('Playlist excluída.')
    await loadPlaylists()
  }

  const addTrackToPlaylist = async (playlistId: string, trackId: string) => {
    const playlist = playlists.find(item => item.id === playlistId)
    if (!playlist || playlist.trackIds.includes(trackId)) {
      setToast('Esta música já está na playlist.')
      return
    }
    const { error } = await supabase.from('playlist_tracks').insert({
      playlist_id: playlistId,
      track_id: trackId,
      position: playlist.trackIds.length + 1,
      added_by: user?.id,
    })
    if (error) {
      setToast(`Não foi possível adicionar a música: ${error.message}`)
      return
    }
    setToast('Música adicionada à playlist.')
    await loadPlaylists()
  }

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    const { error } = await supabase.from('playlist_tracks').delete().eq('playlist_id', playlistId).eq('track_id', trackId)
    if (error) {
      setToast(`Não foi possível remover a música: ${error.message}`)
      return
    }
    setToast('Música removida da playlist.')
    await loadPlaylists()
  }

  const playCollection = (collection: Track[]) => {
    if (!collection.length) return
    const ids = collection.map(track => track.id)
    setQueueTrackIds(ids)
    const index = tracks.findIndex(item => item.id === ids[0])
    if (index < 0) return
    shouldAutoplayRef.current = true
    setCurrentIndex(index)
    setPlaying(true)
  }

  const playTrack = (track: Track) => {
    setQueueTrackIds([])
    const index = tracks.findIndex(item => item.id === track.id)
    if (index < 0) return
    shouldAutoplayRef.current = true
    if (index === currentIndex && audioRef.current) {
      void audioRef.current.play().then(() => {
        setPlaying(true)
        void registerPlay(track)
      }).catch(() => setPlaying(false))
    } else {
      setCurrentIndex(index)
      setPlaying(true)
    }
  }

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio || !current) return
    if (audio.paused) {
      shouldAutoplayRef.current = true
      try {
        await audio.play()
        setPlaying(true)
        void registerPlay(current)
      } catch { setPlaying(false) }
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  const getNextIndex = (direction: 1 | -1) => {
    if (!tracks.length) return 0
    const queue = queueTrackIds.length ? queueTrackIds : tracks.map(track => track.id)
    const currentId = tracks[currentIndex]?.id
    let queueIndex = Math.max(0, queue.indexOf(currentId))
    if (shuffleEnabled && queue.length > 1) {
      let nextQueueIndex = queueIndex
      while (nextQueueIndex === queueIndex) nextQueueIndex = Math.floor(Math.random() * queue.length)
      return Math.max(0, tracks.findIndex(track => track.id === queue[nextQueueIndex]))
    }
    queueIndex = (queueIndex + direction + queue.length) % queue.length
    return Math.max(0, tracks.findIndex(track => track.id === queue[queueIndex]))
  }

  const skip = (direction: 1 | -1) => {
    if (!tracks.length) return
    shouldAutoplayRef.current = true
    setCurrentIndex(getNextIndex(direction))
    setPlaying(true)
  }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    const mediaSession = navigator.mediaSession
    const run = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { mediaSession.setActionHandler(action, handler) } catch { /* ação não suportada pelo navegador */ }
    }

    run('previoustrack', () => skip(-1))
    run('play', () => { void togglePlay() })
    run('pause', () => { void togglePlay() })
    run('nexttrack', () => skip(1))

    // Remove os controles de ±10 segundos do mini player do navegador/Windows.
    run('seekbackward', null)
    run('seekforward', null)

    return () => {
      run('previoustrack', null)
      run('play', null)
      run('pause', null)
      run('nexttrack', null)
    }
  }, [currentIndex, current?.id, tracks.length, playing, shuffleEnabled, queueTrackIds])

  useEffect(() => {
    if (!current || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album,
      artwork: current.coverUrl ? [{ src: current.coverUrl }] : [],
    })
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [current, playing])

  const handleEnded = () => {
    if (!audioRef.current) return
    if (repeatMode === 'one') {
      audioRef.current.currentTime = 0
      playCountedTrackRef.current = null
      void audioRef.current.play().then(() => current && registerPlay(current))
      return
    }
    const activeQueue = queueTrackIds.length ? queueTrackIds : tracks.map(track => track.id)
    const queuePosition = activeQueue.indexOf(current?.id || '')
    if (repeatMode === 'off' && !shuffleEnabled && queuePosition === activeQueue.length - 1) {
      setPlaying(false)
      setProgress(duration)
      return
    }
    skip(1)
  }

  const cycleRepeat = () => setRepeatMode(mode => mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off')

  const toggleFavorite = async (id: string) => {
    if (!user) return
    const isFavorite = favorites.includes(id)
    setFavorites(items => isFavorite ? items.filter(item => item !== id) : [...items, id])
    const result = isFavorite
      ? await supabase.from('user_favorites').delete().eq('user_id', user.id).eq('track_id', id)
      : await supabase.from('user_favorites').insert({ user_id: user.id, track_id: id })
    if (result.error) {
      setFavorites(items => isFavorite ? [...items, id] : items.filter(item => item !== id))
      setToast(`Não foi possível atualizar favoritos: ${result.error.message}`)
    }
  }

  const downloadTrack = async (track: Track) => {
    if (!track.downloadable) {
      setToast('O download desta música não foi autorizado pelo administrador.')
      return
    }
    setDownloadingId(track.id)
    try {
      const extension = track.audioPath.split('.').pop() || 'mp3'
      const filename = `${safeFilename(track.artist)} - ${safeFilename(track.title)}.${extension}`
      const { data, error } = await supabase.storage.from('music-audio').createSignedUrl(track.audioPath, 60, { download: filename })
      if (error || !data?.signedUrl) throw error || new Error('Link de download indisponível.')
      const response = await fetch(data.signedUrl)
      if (!response.ok) throw new Error('Não foi possível baixar o arquivo.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setToast('Download iniciado com sucesso.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Não foi possível baixar a música.')
    } finally {
      setDownloadingId(null)
    }
  }

  const shufflePlay = () => {
    if (!tracks.length) return
    setShuffleEnabled(true)
    shouldAutoplayRef.current = true
    let index = Math.floor(Math.random() * tracks.length)
    if (tracks.length > 1 && index === currentIndex) index = (index + 1) % tracks.length
    setCurrentIndex(index)
    setPlaying(true)
  }

  const coverStyle = (track: Track) => track.coverUrl
    ? { backgroundImage: `url("${track.coverUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'linear-gradient(145deg,#7b4c2d,#294535)' }

  const sectionTitle = activeNav === 'Favoritos' ? 'Músicas favoritas' : activeNav === 'Downloads' ? 'Downloads disponíveis' : 'Músicas publicadas'

  return (
    <div className="app-shell">
      {toast && <div className="premium-toast">{toast}</div>}
      {current && <audio ref={audioRef} src={current.audioUrl} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={event => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={event => {
        const value = Number.isFinite(event.currentTarget.duration) ? Math.round(event.currentTarget.duration) : 0
        setDuration(value)
        if (value > 0 && current.durationSeconds !== value) {
          setTracks(items => items.map(item => item.id === current.id ? { ...item, durationSeconds: value } : item))
          void supabase.from('tracks').update({ duration_seconds: value }).eq('id', current.id)
        }
      }} onError={() => {
        setPlaying(false)
        setToast('Não foi possível reproduzir esta faixa. Verifique o arquivo de áudio enviado.')
      }} onEnded={handleEnded} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top"><Brand /><button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)}><X /></button></div>
        <nav className="sidebar-nav">
          <p className="nav-section">Sua música</p>
          {nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveNav(label); setSelectedAlbumKey(null); setSelectedGenre(null); setSidebarOpen(false) }} className={`nav-item ${activeNav === label ? 'active' : ''}`}><Icon size={19} /><span>{label}</span></button>)}
          {profile?.role === 'admin' && <><p className="nav-section admin-section">Administração</p><button className="nav-item" onClick={() => navigate('/admin')}><SlidersHorizontal size={19}/><span>LIVE MUSIC Studio</span></button><button className="nav-item" onClick={() => navigate('/admin/users')}><Users size={19}/><span>Usuários</span></button><button className="nav-item" onClick={() => navigate('/admin/settings')}><Settings size={19}/><span>Configurações</span></button></>}
        </nav>
        <div className="sidebar-profile"><div className="avatar">{displayName.charAt(0).toUpperCase()}</div><div className="profile-copy"><strong>{displayName}</strong><span>{profile?.role === 'admin' ? 'Administrador' : profile?.plan === 'premium' ? 'Premium' : 'Plano gratuito'}</span></div><button onClick={() => void signOut()} className="icon-button"><LogOut size={18}/></button></div>
      </aside>
      {sidebarOpen && <button className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="content-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)}><Menu /></button><button className="round-nav desktop-only"><ChevronLeft /></button><button className="round-nav desktop-only"><ChevronRight /></button></div>
          <label className="search-box"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar músicas, artistas, álbuns e gêneros" />{query && <button onClick={() => setQuery('')}><X size={16}/></button>}</label>
          <div className="topbar-actions"><button className="icon-button"><Bell size={19}/></button><div className="profile-menu-wrap"><button className="profile-pill" onClick={() => setProfileMenuOpen(value => !value)}><span className="profile-dot">{displayName.charAt(0).toUpperCase()}</span><span className="desktop-only">{displayName}</span></button>{profileMenuOpen && <div className="profile-menu"><button onClick={() => { navigate('/admin/settings'); setProfileMenuOpen(false) }}>Meu perfil e configurações</button>{profile?.role === 'admin' && <button onClick={() => { navigate('/admin/users'); setProfileMenuOpen(false) }}>Gerenciar usuários</button>}<button onClick={() => void signOut()}>Sair</button></div>}</div></div>
        </header>

        <section className="dashboard-content">
          <div className="welcome-row"><div><span className="eyebrow">LIVE MUSIC • V3.5.7 STUDIO PRO</span><h1>{selectedAlbum ? selectedAlbum.title : selectedGenre ? selectedGenre : activeNav === 'Início' ? `Olá, ${displayName}.` : activeNav}</h1><p>{selectedAlbum ? `${selectedAlbum.artist} • ${selectedAlbum.tracks.length} faixas` : selectedGenre ? `Todas as músicas de ${selectedGenre}` : 'Navegação organizada por gêneros, álbuns e coleções.'}</p></div><div className="welcome-actions desktop-only"><button className="soft-button" onClick={() => void loadCatalog(true)} disabled={catalogRefreshing}><RefreshCw size={17} className={catalogRefreshing ? 'spin-icon' : ''}/> Atualizar</button><button className={`soft-button ${shuffleEnabled ? 'control-active' : ''}`} onClick={() => setShuffleEnabled(value => !value)} disabled={!tracks.length}><Shuffle size={17}/> Misturar</button><button className="primary-button" onClick={togglePlay} disabled={!current}>{playing ? <Pause size={17}/> : <Play size={17} fill="currentColor"/>} {playing ? 'Pausar' : 'Ouvir agora'}</button></div></div><div className="mobile-player-actions mobile-only"><button onClick={() => void loadCatalog(true)} disabled={catalogRefreshing}><RefreshCw size={17} className={catalogRefreshing ? 'spin-icon' : ''}/> Atualizar</button><button className={shuffleEnabled ? 'control-active' : ''} onClick={() => setShuffleEnabled(value => !value)}><Shuffle size={17}/> Aleatório</button><button className={repeatMode !== 'off' ? 'control-active' : ''} onClick={cycleRepeat}>{repeatMode === 'one' ? <Repeat1 size={17}/> : <Repeat size={17}/>} Repetir</button></div>

          {catalogError && <div className="studio-notice error">{catalogError}</div>}

          {activeNav === 'Início' && !query && !selectedGenre && current && <article className="hero-card"><div className="hero-glow"/><div className="hero-content"><span className="hero-kicker"><Sparkles size={15}/> Música em destaque</span><h2>{current.title}<br/><em>{current.artist}</em></h2><p>{current.album} • {current.genre} • {current.playCount} reproduções</p><div className="hero-actions"><button className="hero-play" onClick={() => playTrack(current)}><Play fill="currentColor"/> Reproduzir</button><button className={`hero-like ${favorites.includes(current.id) ? 'liked' : ''}`} onClick={() => void toggleFavorite(current.id)}><Heart fill={favorites.includes(current.id) ? 'currentColor' : 'none'}/></button>{current.downloadable && <button className="hero-like" title="Baixar música" onClick={() => void downloadTrack(current)}><Download /></button>}</div></div><div className="hero-art"><div className={`vinyl ${playing ? 'spinning' : ''}`}><div className="vinyl-label">LIVE<br/>MUSIC</div></div><div className="sound-lines">{Array.from({length:19}).map((_,i)=><span key={i} style={{height:`${24+(i%5)*12}px`}}/>)}</div></div></article>}

          <div className="lower-grid v2-grid">
            <section className="section-block recent-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{query ? 'RESULTADOS DA BUSCA' : selectedAlbum ? 'ÁLBUM SELECIONADO' : selectedGenre ? 'GÊNERO SELECIONADO' : activeNav === 'Início' ? 'DESCUBRA POR GÊNERO' : activeNav === 'Álbuns' ? 'COLEÇÕES ORGANIZADAS' : activeNav === 'Playlists' ? 'SUAS PLAYLISTS' : activeNav === 'Favoritos' ? 'SUA COLEÇÃO' : activeNav === 'Downloads' ? 'DOWNLOADS AUTORIZADOS' : 'CATÁLOGO SINCRONIZADO V3.5.6'}</span>
                  <h3>{query ? `Resultados para “${query}”` : selectedAlbum ? selectedAlbum.title : selectedGenre ? selectedGenre : activeNav === 'Início' ? 'Gêneros musicais' : activeNav === 'Álbuns' ? 'Álbuns' : activeNav === 'Playlists' ? (selectedPlaylist?.title || 'Playlists') : sectionTitle}</h3>
                </div>
                <span className="track-count">{selectedAlbum ? `${selectedAlbum.tracks.length} faixas` : selectedGenre ? `${selectedGenreTracks.length} faixas` : activeNav === 'Álbuns' ? `${albumGroups.length} álbuns` : activeNav === 'Playlists' && !selectedPlaylist ? `${playlists.length} playlists` : `${visibleTracks.length} faixas`}</span>
              </div>

              {selectedAlbum && !query ? <div className="album-detail-view">
                <button className="detail-back" onClick={() => setSelectedAlbumKey(null)}><ChevronLeft size={18}/> Voltar aos álbuns</button>
                <div className="album-detail-hero">
                  <div className="album-detail-cover" style={selectedAlbum.coverUrl ? { backgroundImage: `url("${selectedAlbum.coverUrl}")` } : undefined}>{!selectedAlbum.coverUrl && <Disc3 size={58}/>}</div>
                  <div className="album-detail-copy"><span className="eyebrow">ÁLBUM</span><h2>{selectedAlbum.title}</h2><p>{selectedAlbum.artist}</p><small>{selectedAlbum.tracks.length} {selectedAlbum.tracks.length === 1 ? 'faixa' : 'faixas'}</small><button className="primary-button" onClick={() => playCollection(selectedAlbum.tracks)}><Play size={17} fill="currentColor"/> Reproduzir álbum</button></div>
                </div>
                <div className="track-list album-detail-list">{selectedAlbum.tracks.map((track, index) => <div className={`track-row ${current?.id === track.id ? 'current-track' : ''}`} key={track.id}><span className="album-track-number">{index + 1}</span><button className="track-cover" style={coverStyle(track)} onClick={() => playTrack(track)}>{!track.coverUrl && '♪'}</button><button className="track-info" onClick={() => playTrack(track)}><strong>{track.title}</strong><small>{track.artist}</small></button><span className="track-time">{formatTime(track.durationSeconds)}</span><button className={`track-heart ${favorites.includes(track.id) ? 'liked' : ''}`} onClick={() => void toggleFavorite(track.id)}><Heart size={17} fill={favorites.includes(track.id) ? 'currentColor' : 'none'}/></button><button className="row-play" onClick={() => current?.id === track.id && playing ? void togglePlay() : playTrack(track)}>{current?.id === track.id && playing ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button></div>)}</div>
              </div> : selectedGenre && !query ? <div className="genre-detail-view">
                <button className="detail-back" onClick={() => setSelectedGenre(null)}><ChevronLeft size={18}/> Voltar aos gêneros</button>
                <div className="genre-detail-hero"><div><span className="eyebrow">GÊNERO</span><h2>{selectedGenre}</h2><p>{selectedGenreTracks.length} músicas disponíveis</p></div><button className="primary-button" onClick={() => playCollection(selectedGenreTracks)}><Play size={17} fill="currentColor"/> Reproduzir tudo</button></div>
                <div className="track-list">{selectedGenreTracks.map(track => <div className={`track-row ${current?.id === track.id ? 'current-track' : ''}`} key={track.id}><button className="row-play" onClick={() => current?.id === track.id && playing ? void togglePlay() : playTrack(track)}>{current?.id === track.id && playing ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><button className="track-cover" style={coverStyle(track)} onClick={() => playTrack(track)}>{!track.coverUrl && '♪'}</button><button className="track-info" onClick={() => playTrack(track)}><strong>{track.title}</strong><small>{track.artist} • {track.album}</small></button><span className="track-time">{formatTime(track.durationSeconds)}</span><button className={`track-heart ${favorites.includes(track.id) ? 'liked' : ''}`} onClick={() => void toggleFavorite(track.id)}><Heart size={17} fill={favorites.includes(track.id) ? 'currentColor' : 'none'}/></button></div>)}</div>
              </div> : activeNav === 'Início' && !query ? <div className="genre-shelves">
                {genreGroups.map(group => <section className="genre-shelf" key={group.name}><div className="genre-shelf-head"><div><span className="eyebrow">GÊNERO</span><h4>{group.name}</h4></div><button className="text-button" onClick={() => setSelectedGenre(group.name)}>Ver todas <ChevronRight size={15}/></button></div><div className="genre-track-grid">{group.tracks.slice(0, 6).map(track => <article className="genre-track-card" key={track.id}><button className="genre-card-cover" style={coverStyle(track)} onClick={() => playTrack(track)}>{!track.coverUrl && <Disc3 size={32}/>}<span><Play size={18} fill="currentColor"/></span></button><button className="genre-card-copy" onClick={() => playTrack(track)}><strong>{track.title}</strong><small>{track.artist}</small></button></article>)}</div></section>)}
              </div> : activeNav === 'Álbuns' && !query ? <div className="album-grid">
                {albumGroups.map(album => <article className="album-card album-card-clickable" key={album.key}>
                  <button className="album-cover" style={album.coverUrl ? { backgroundImage: `url("${album.coverUrl}")` } : undefined} onClick={() => setSelectedAlbumKey(album.key)}>{!album.coverUrl && <Disc3 size={36}/>}<span className="album-play"><ChevronRight/></span></button>
                  <button className="album-copy album-copy-button" onClick={() => setSelectedAlbumKey(album.key)}><h4>{album.title}</h4><p>{album.artist}</p><small>{album.tracks.length} {album.tracks.length === 1 ? 'faixa' : 'faixas'}</small></button>
                  <button className="soft-button album-action" onClick={() => playCollection(album.tracks)}><Play size={16} fill="currentColor"/> Reproduzir álbum</button>
                </article>)}
              </div> : activeNav === 'Playlists' && !query ? <div className="playlist-workspace">
                <div className="playlist-sidebar-panel">
                  <div className="playlist-create"><input value={playlistName} onChange={event => setPlaylistName(event.target.value)} placeholder="Nome da nova playlist" onKeyDown={event => { if (event.key === 'Enter') void createPlaylist() }}/><button className="primary-button" onClick={() => void createPlaylist()} disabled={playlistBusy || !playlistName.trim()}><Plus size={17}/> Criar</button></div>
                  <div className="playlist-list">{playlists.map(playlist => <div className={`playlist-item ${selectedPlaylistId === playlist.id ? 'selected' : ''}`} key={playlist.id}><button onClick={() => setSelectedPlaylistId(playlist.id)}><ListMusic size={19}/><span><strong>{playlist.title}</strong><small>{playlist.trackIds.length} faixas</small></span></button><button className="danger-icon" title="Excluir playlist" onClick={() => void deletePlaylist(playlist.id)}><Trash2 size={16}/></button></div>)}{!playlists.length && <div className="empty-state compact"><ListMusic size={26}/><h4>Crie sua primeira playlist</h4><p>Ela será sincronizada no celular e no computador.</p></div>}</div>
                </div>
                <div className="playlist-content-panel">{selectedPlaylist ? <><div className="playlist-hero"><div><span className="eyebrow">PLAYLIST PESSOAL</span><h3>{selectedPlaylist.title}</h3><p>{selectedPlaylistTracks.length} faixas sincronizadas</p></div><button className="primary-button" onClick={() => playCollection(selectedPlaylistTracks)} disabled={!selectedPlaylistTracks.length}><Play size={17} fill="currentColor"/> Reproduzir</button></div><div className="track-list">{selectedPlaylistTracks.map(track => <div className={`track-row ${current?.id === track.id ? 'current-track' : ''}`} key={track.id}><button className="row-play" onClick={() => playTrack(track)}><Play size={15} fill="currentColor"/></button><button className="track-cover" style={coverStyle(track)} onClick={() => playTrack(track)}>{!track.coverUrl && '♪'}</button><button className="track-info" onClick={() => playTrack(track)}><strong>{track.title}</strong><small>{track.artist}</small></button><span className="track-album desktop-only">{track.album}</span><button className="danger-icon" title="Remover da playlist" onClick={() => void removeTrackFromPlaylist(selectedPlaylist.id, track.id)}><Trash2 size={17}/></button></div>)}{!selectedPlaylistTracks.length && <div className="empty-state"><Disc3 size={28}/><h4>Playlist vazia</h4><p>Use o botão “+ Playlist” nas músicas do catálogo.</p></div>}</div></> : <div className="empty-state"><ListMusic size={32}/><h4>Selecione ou crie uma playlist</h4><p>Suas playlists ficam sincronizadas em todos os dispositivos.</p></div>}</div>
              </div> : <div className="track-list">
                {catalogLoading ? <div className="empty-state"><Disc3 size={28}/><h4>Carregando catálogo...</h4><p>Buscando músicas publicadas no Supabase.</p></div> : visibleTracks.length ? visibleTracks.map(track => <div className={`track-row ${current?.id === track.id ? 'current-track' : ''}`} key={track.id}><button className="row-play" onClick={() => current?.id === track.id && playing ? void togglePlay() : playTrack(track)}>{current?.id === track.id && playing ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><button className="track-cover" style={coverStyle(track)} onClick={() => playTrack(track)}>{!track.coverUrl && '♪'}</button><button className="track-info" onClick={() => playTrack(track)}><strong>{track.title}</strong><small>{track.artist}</small></button><span className="track-album desktop-only">{track.album}</span><span className="genre-pill desktop-only">{track.genre}</span><span className="track-time">{current?.id === track.id && duration ? formatTime(duration) : formatTime(track.durationSeconds)}</span><button className={`track-heart ${favorites.includes(track.id) ? 'liked' : ''}`} onClick={() => void toggleFavorite(track.id)}><Heart size={17} fill={favorites.includes(track.id) ? 'currentColor' : 'none'}/></button>{playlists.length ? <select className="playlist-select" defaultValue="" onChange={event => { const id = event.target.value; if (id) void addTrackToPlaylist(id, track.id); event.currentTarget.value = '' }}><option value="">+ Playlist</option>{playlists.map(playlist => <option value={playlist.id} key={playlist.id}>{playlist.title}</option>)}</select> : null}{track.downloadable ? <button className="more-button" title="Baixar" disabled={downloadingId === track.id} onClick={() => void downloadTrack(track)}><Download size={18}/></button> : <button className="more-button" title="Download não permitido"><MoreHorizontal size={19}/></button>}</div>) : <div className="empty-state"><Disc3 size={28}/><h4>Nenhuma música encontrada</h4><p>{activeNav === 'Downloads' ? 'Nenhuma música está liberada para download.' : activeNav === 'Favoritos' ? 'Adicione músicas aos favoritos para vê-las aqui.' : 'Publique uma música pelo LIVE MUSIC Studio.'}</p></div>}
              </div>}
            </section>
            <aside className="radio-card"><span className="radio-live"><i/> PLAYER PREMIUM</span><Radio size={34}/><h3>LIVE MUSIC</h3><p>Catálogo organizado por gêneros, álbuns dedicados e player móvel com capa.</p><button onClick={shufflePlay} disabled={!tracks.length}><Play fill="currentColor"/> Ouvir catálogo</button></aside>
          </div>
        </section>
      </main>

      <div className="institutional-footer">LIVE MUSIC V3.5.7 • © 2026 • Desenvolvido por <strong>Cristiano Lucas dos Santos</strong> • Todos os direitos reservados.</div>
      <footer className="player-bar premium-player">
        {current ? <><div className="now-playing"><div className="mini-cover mini-cover-premium" style={coverStyle(current)}>{!current.coverUrl && '♪'}</div><div><strong>{current.title}</strong><span>{current.artist} • {current.album}</span></div><button className={`icon-button desktop-only ${favorites.includes(current.id) ? 'liked' : ''}`} onClick={() => void toggleFavorite(current.id)}><Heart size={17} fill={favorites.includes(current.id) ? 'currentColor' : 'none'}/></button>{current.downloadable && <button className="icon-button desktop-only" title="Baixar" onClick={() => void downloadTrack(current)}><Download size={17}/></button>}</div>
        <div className="player-center"><div className="player-controls"><button className={shuffleEnabled ? 'control-active' : ''} onClick={() => setShuffleEnabled(value => !value)} title="Aleatório"><Shuffle size={16}/></button><button onClick={() => skip(-1)} title="Anterior"><SkipBack size={20} fill="currentColor"/></button><button className="main-play" onClick={togglePlay}>{playing ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button><button onClick={() => skip(1)} title="Próxima"><SkipForward size={20} fill="currentColor"/></button><button className={repeatMode !== 'off' ? 'control-active' : ''} onClick={cycleRepeat} title={`Repetição: ${repeatMode}`}>{repeatMode === 'one' ? <Repeat1 size={17}/> : <Repeat size={17}/>}</button></div><div className="progress-row"><span>{formatTime(progress)}</span><input className="progress-range" type="range" min="0" max={duration || 0} value={Math.min(progress,duration || 0)} onChange={e => { const value=Number(e.target.value); if(audioRef.current) audioRef.current.currentTime=value; setProgress(value) }}/><span>{formatTime(duration)}</span></div></div>
        <div className="player-volume desktop-only"><button className="volume-icon" onClick={() => setVolume(value => value === 0 ? .72 : 0)}>{volume === 0 ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button><input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))}/></div></> : <div className="now-playing"><div className="mini-cover">♪</div><div><strong>Nenhuma música disponível</strong><span>Publique uma música no Studio</span></div></div>}
      </footer>
    </div>
  )
}
