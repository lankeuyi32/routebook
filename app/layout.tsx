import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

const SITE_AUTHOR = 'Lanc Aer'
const SITE_AUTHOR_URL = 'https://github.com/lankeuyi32'
const SITE_TITLE = '骑行路书制作 · Route Planner'
const SITE_DESCRIPTION = '专业骑行路线规划工具，支持地点搜索、路线规划、海拔剖面与多格式导出'

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: '骑行路书制作',
  authors: [{ name: SITE_AUTHOR, url: SITE_AUTHOR_URL }],
  creator: SITE_AUTHOR,
  publisher: SITE_AUTHOR,
  generator: 'v0.app',
  keywords: ['骑行', '路线规划', 'Route Planner', '高德地图', '海拔', 'GPX', '骑行路书'],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: '骑行路书制作',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: '@lankeuyi32',
  },
  other: {
    copyright: `© ${new Date().getFullYear()} ${SITE_AUTHOR}`,
  },
  // 图标由 Next.js App Router 约定自动接管：
  // - app/icon.svg → favicon
  // - app/apple-icon.tsx → apple-touch-icon (180×180 PNG，由 ImageResponse 动态生成)
}

export const viewport: Viewport = {
  // 品牌主色（与 logo 一致），影响 PWA / iOS 状态栏 / Android 任务卡片
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
