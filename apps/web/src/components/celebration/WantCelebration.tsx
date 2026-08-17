import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Trophy, X } from 'lucide-react'

interface WantCelebrationProps {
  onClose: () => void
}

const CONFETTI_COLORS = ['#e879f9', '#818cf8', '#38bdf8', '#fbbf24', '#34d399', '#fb7185', '#a78bfa']

interface ConfettiPiece {
  left: number
  delay: number
  duration: number
  color: string
  size: number
  radius: number
}

function useConfettiPieces(count: number): ConfettiPiece[] {
  const [pieces] = useState<ConfettiPiece[]>(() =>
    Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2.2 + Math.random() * 1.6,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 6,
      radius: Math.random() > 0.65 ? 50 : 2,
    })),
  )
  return pieces
}

export function WantCelebration({ onClose }: WantCelebrationProps) {
  const pieces = useConfettiPieces(46)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current(), 4800)
    return () => window.clearTimeout(timer)
  }, [])

  return createPortal(
    <>
      <style>{`
        @keyframes wantConfettiFall {
          0% { transform: translateY(-8vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(108vh) rotate(720deg); opacity: 0; }
        }
        @keyframes wantBannerPop {
          0% { transform: translateY(16px) scale(0.85); opacity: 0; }
          60% { transform: translateY(-4px) scale(1.04); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
        {pieces.map((piece, index) => (
          <span
            key={index}
            className="absolute top-0 block"
            style={{
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size + 4,
              backgroundColor: piece.color,
              borderRadius: `${piece.radius}px`,
              animation: `wantConfettiFall ${piece.duration}s ${piece.delay}s cubic-bezier(0.22, 1, 0.36, 1) both`,
            }}
          />
        ))}
      </div>

      <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden p-4" role="dialog" aria-modal="true" aria-label="Deseo completado">
        <div
          className="relative w-full max-w-sm rounded-2xl border border-primary/25 bg-surface p-6 text-center shadow-vault"
          style={{ animation: 'wantBannerPop 440ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1 text-muted-gray transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Cerrar felicitacion"
          >
            <X className="size-4" />
          </button>

          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/15">
            <Trophy className="size-7 text-accent" />
          </div>

          <h3 className="mt-4 text-lg font-semibold text-on-surface">¡Deseo Completado!</h3>
          <p className="mt-2 text-sm leading-6 text-muted-gray">Felicidades, sigue trabajando duro y lograrás más objetivos.</p>

          <div className="mt-4 flex items-center justify-center gap-1">
            <Sparkles className="size-4 text-primary" />
            <Sparkles className="size-3 text-primary/60" />
            <Sparkles className="size-4 text-accent" />
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}