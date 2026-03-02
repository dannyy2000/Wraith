export function WraithIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ghost-grad" x1="0" y1="0" x2="32" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
        <filter id="ghost-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Ghost body */}
      <path
        d="M16 1C8.268 1 2 7.268 2 15v17.5l4.5-3.5 4.5 3.5 5-3.5 5 3.5 4.5-3.5V15C30 7.268 23.732 1 16 1z"
        fill="url(#ghost-grad)"
        filter="url(#ghost-glow)"
      />
      {/* Eyes */}
      <circle cx="11" cy="14" r="3" fill="white" opacity="0.95" />
      <circle cx="21" cy="14" r="3" fill="white" opacity="0.95" />
      {/* Pupils */}
      <circle cx="11.8" cy="14.8" r="1.4" fill="#0a0a14" />
      <circle cx="21.8" cy="14.8" r="1.4" fill="#0a0a14" />
    </svg>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <WraithIcon className="w-7 h-7" />
      <span className="font-bold text-xl tracking-tight text-white">
        wraith
      </span>
    </div>
  )
}
