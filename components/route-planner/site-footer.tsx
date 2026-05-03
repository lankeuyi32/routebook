import Link from "next/link"
import { cn } from "@/lib/utils"

interface Props {
  className?: string
}

/**
 * 全站统一页脚：版权 + 作者 + 关于页 / GitHub 链接。
 * 桌面在 LeftPanel 底部、移动在 BottomToolbar 上方。
 */
export function SiteFooter({ className }: Props) {
  const year = new Date().getFullYear()
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border bg-card px-3 py-2",
        "text-[11px] leading-tight text-muted-foreground",
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-1",
        className,
      )}
    >
      <span className="truncate">
        © {year} <span className="font-medium text-foreground">Lanc Aer</span>
      </span>
      <span className="flex items-center gap-2.5">
        <Link
          href="/about"
          className="hover:text-foreground transition-colors"
        >
          关于
        </Link>
        <span aria-hidden className="text-border">·</span>
        <a
          href="https://github.com/lankeuyi32"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          GitHub
        </a>
      </span>
    </footer>
  )
}
