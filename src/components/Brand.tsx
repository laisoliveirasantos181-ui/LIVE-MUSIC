import { Headphones, Music2 } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-live-gold/40 bg-live-card shadow-glow">
        <Headphones className="h-6 w-6 text-live-gold" />
        <Music2 className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-live-green p-0.5 text-live-cream" />
      </div>
      {!compact && (
        <div>
          <p className="text-xl font-black tracking-[0.18em] text-live-cream">LIVE MUSIC</p>
          <p className="text-xs text-live-muted">Sua trilha sonora, sempre.</p>
        </div>
      )}
    </div>
  )
}
