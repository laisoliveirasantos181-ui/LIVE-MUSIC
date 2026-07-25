export type AudioMetadata = {
  title: string
  artist: string
  album: string
  genre: string
  trackNumber: string
  year: string
  durationSeconds: number | null
  coverFile: File | null
}

const textDecoder = (encoding: number) => {
  if (encoding === 1 || encoding === 2) return new TextDecoder('utf-16')
  if (encoding === 3) return new TextDecoder('utf-8')
  return new TextDecoder('iso-8859-1')
}

const cleanText = (value: string) => value.replace(/\0/g, '').trim()

const syncSafeInt = (bytes: Uint8Array) =>
  ((bytes[0] & 0x7f) << 21) | ((bytes[1] & 0x7f) << 14) | ((bytes[2] & 0x7f) << 7) | (bytes[3] & 0x7f)

const uint32 = (bytes: Uint8Array) =>
  ((bytes[0] << 24) >>> 0) + ((bytes[1] << 16) >>> 0) + ((bytes[2] << 8) >>> 0) + (bytes[3] >>> 0)

const fallbackTitle = (filename: string) => filename.replace(/\.[^.]+$/, '').replace(/^\s*\d+[\s._-]+/, '').trim()

const getDuration = (file: File) => new Promise<number | null>((resolve) => {
  const audio = document.createElement('audio')
  const url = URL.createObjectURL(file)
  let settled = false
  const finish = (value: number | null) => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    audio.removeAttribute('src')
    audio.load()
    URL.revokeObjectURL(url)
    resolve(value)
  }
  const read = () => {
    const value = audio.duration
    if (Number.isFinite(value) && value > 0) finish(Math.round(value))
  }
  const timeout = window.setTimeout(() => finish(null), 15000)
  audio.preload = 'metadata'
  audio.onloadedmetadata = read
  audio.ondurationchange = read
  audio.oncanplay = read
  audio.onerror = () => finish(null)
  audio.src = url
  audio.load()
})


const parseApic = (payload: Uint8Array, encoding: number, filename: string): File | null => {
  let cursor = 1
  let mimeEnd = cursor
  while (mimeEnd < payload.length && payload[mimeEnd] !== 0) mimeEnd++
  const mime = cleanText(new TextDecoder('iso-8859-1').decode(payload.slice(cursor, mimeEnd))) || 'image/jpeg'
  cursor = mimeEnd + 1
  cursor += 1

  const isUtf16 = encoding === 1 || encoding === 2
  if (isUtf16) {
    while (cursor + 1 < payload.length && !(payload[cursor] === 0 && payload[cursor + 1] === 0)) cursor += 2
    cursor += 2
  } else {
    while (cursor < payload.length && payload[cursor] !== 0) cursor++
    cursor += 1
  }

  if (cursor >= payload.length) return null
  const extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
  return new File([payload.slice(cursor)], `${fallbackTitle(filename)}-capa.${extension}`, { type: mime })
}

export async function readAudioMetadata(file: File): Promise<AudioMetadata> {
  const result: AudioMetadata = {
    title: fallbackTitle(file.name),
    artist: '',
    album: '',
    genre: '',
    trackNumber: '',
    year: '',
    durationSeconds: await getDuration(file),
    coverFile: null,
  }

  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0, 3)) !== 'ID3') return result

    const version = bytes[3]
    const tagSize = syncSafeInt(bytes.slice(6, 10))
    let offset = 10
    const end = Math.min(bytes.length, 10 + tagSize)
    const frameMap: Record<string, keyof Pick<AudioMetadata, 'title' | 'artist' | 'album' | 'genre' | 'trackNumber' | 'year'>> = {
      TIT2: 'title',
      TPE1: 'artist',
      TALB: 'album',
      TCON: 'genre',
      TRCK: 'trackNumber',
      TYER: 'year',
      TDRC: 'year',
    }

    while (offset + 10 <= end) {
      const frameId = new TextDecoder('ascii').decode(bytes.slice(offset, offset + 4))
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break
      const sizeBytes = bytes.slice(offset + 4, offset + 8)
      const frameSize = version === 4 ? syncSafeInt(sizeBytes) : uint32(sizeBytes)
      if (!frameSize || offset + 10 + frameSize > end) break
      const payload = bytes.slice(offset + 10, offset + 10 + frameSize)

      if (frameMap[frameId] && payload.length > 1) {
        const encoding = payload[0]
        const value = cleanText(textDecoder(encoding).decode(payload.slice(1)))
        if (value) result[frameMap[frameId]] = value
      } else if (frameId === 'APIC' && payload.length > 8) {
        result.coverFile = parseApic(payload, payload[0], file.name)
      }
      offset += 10 + frameSize
    }
  } catch {
    // Arquivos sem ID3 continuam disponíveis para revisão manual.
  }

  return result
}
