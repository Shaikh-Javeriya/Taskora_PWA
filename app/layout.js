import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

// ✅ Metadata (NO viewport, NO themeColor here)
export const metadata = {
  title: 'Taskora - Project Management Dashboard',
  description:
    'A local-first project management and task tracking PWA for freelancers and small teams.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
}

// ✅ Viewport config (THIS is the only place)
export const viewport = {
  themeColor: '#3B82F6',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800`}
      >
        {children}
      </body>
    </html>
  )
}
