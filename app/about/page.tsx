import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Bike, Github, Mail, Shield, Users } from "lucide-react"

export const metadata: Metadata = {
  title: "关于 · 骑行路书制作",
  description: "项目作者、开源协议与联系方式",
}

export default function AboutPage() {
  const year = new Date().getFullYear()
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        {/* 返回 */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-4" />
          返回路书制作
        </Link>

        {/* 标题区 */}
        <header className="flex items-center gap-3 mb-8">
          <div className="size-12 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
            <Bike className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">骑行路书制作</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Route Planner
            </p>
          </div>
        </header>

        {/* 项目介绍 */}
        <section className="space-y-4 text-[15px] leading-relaxed text-foreground/90 mb-10">
          <p>
            一款专业的骑行路线规划工具，支持地点搜索、智能路线规划、海拔剖面分析与多格式导入导出（GPX / TCX / KML / CSV）。
          </p>
          <p>
            底图与路径规划基于
            <a
              href="https://lbs.amap.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-1 underline underline-offset-2 hover:text-foreground"
            >
              高德开放平台
            </a>
            ，海拔数据来自全球公开 DEM。所有用户操作（点位 / 路线 / 文件）均在浏览器本地完成，**不上传任何后端数据库**。
          </p>
        </section>

        {/* 作者信息 */}
        <section className="border border-border rounded-lg p-5 bg-card mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="size-3.5" />
            作者
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-base font-semibold">Lanc Aer</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                独立开发者 · 项目所有者与维护者
              </p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Github className="size-4 text-muted-foreground shrink-0" />
                <a
                  href="https://github.com/lankeuyi32"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline underline-offset-2"
                >
                  github.com/lankeuyi32
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground shrink-0" />
                <a
                  href="mailto:lankeuyi32@gmail.com"
                  className="hover:underline underline-offset-2"
                >
                  lankeuyi32@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </section>

        {/* 安全 / 漏洞反馈 */}
        <section className="border border-border rounded-lg p-5 bg-card mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <Shield className="size-3.5" />
            安全反馈
          </h2>
          <p className="text-sm text-foreground/85">
            如发现安全漏洞或隐私问题，请通过邮件
            <a
              href="mailto:lankeuyi32@gmail.com"
              className="mx-1 underline underline-offset-2 hover:text-foreground"
            >
              lankeuyi32@gmail.com
            </a>
            或
            <a
              href="/.well-known/security.txt"
              className="mx-1 underline underline-offset-2 hover:text-foreground"
            >
              security.txt
            </a>
            私下联系，我会尽快回复。请勿在公开 issue 中披露未修复的安全漏洞。
          </p>
        </section>

        {/* 版权 */}
        <section className="text-xs text-muted-foreground space-y-1.5">
          <p>
            © {year} <span className="text-foreground font-medium">Lanc Aer</span> · 保留所有权利
          </p>
          <p>
            源码遵循 <span className="font-mono">MIT License</span>，地图数据版权归
            <a
              href="https://lbs.amap.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-1 underline underline-offset-2"
            >
              高德开放平台
            </a>
            所有。
          </p>
        </section>
      </div>
    </main>
  )
}
