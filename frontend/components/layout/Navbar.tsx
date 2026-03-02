'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { usePathname } from 'next/navigation'
import { Logo } from './Logo'

const NAV_LINKS = [
  { href: '/markets', label: 'Markets' },
  { href: '/create', label: 'Create' },
  { href: '/claims', label: 'My Claims' },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: 'rgba(8,8,16,0.85)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/markets">
          <Logo />
        </Link>

        <div className="flex items-center gap-8">
          <div className="hidden sm:flex items-center gap-6">
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors relative pb-px ${
                    active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {link.label}
                  {active && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full"
                      style={{ background: 'linear-gradient(90deg, #8B5CF6, #6D28D9)' }}
                    />
                  )}
                </Link>
              )
            })}
          </div>
          <ConnectButton chainStatus="icon" showBalance={false} />
        </div>
      </div>
    </nav>
  )
}
