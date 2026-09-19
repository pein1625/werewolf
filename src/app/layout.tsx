import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ma Sói Online',
  description: 'Thay bộ bài ma sói — quản trò điều khiển, người chơi chỉ thấy lá của mình.',
}

export const viewport: Viewport = {
  themeColor: '#0a0b10',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  )
}
