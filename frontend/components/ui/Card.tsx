import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  glow?: boolean
}

export function Card({ children, className, glow = false }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl p-5 transition-all',
        glow ? 'shadow-card-hover' : 'shadow-card',
        className
      )}
      style={{
        background: 'linear-gradient(145deg, #0f0f1a 0%, #111120 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {children}
    </div>
  )
}
