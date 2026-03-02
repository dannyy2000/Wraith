import { type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'text-white font-semibold disabled:opacity-40',
  secondary:
    'bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 hover:border-white/20 disabled:opacity-40',
  ghost:
    'bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white disabled:opacity-40',
  danger:
    'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 hover:border-red-500/50 disabled:opacity-40',
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    boxShadow: '0 0 20px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  secondary: {},
  ghost: {},
  danger: {},
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{ ...variantStyles[variant], ...style }}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all cursor-pointer',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Spinner className="w-4 h-4" />}
      {children}
    </button>
  )
}
