import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Web3Provider } from '@/providers/Web3Provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Wraith — Private Prediction Markets',
  description: 'Privacy-first prediction markets on Arbitrum. Bet privately, settle automatically.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans min-h-screen bg-black`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  )
}
