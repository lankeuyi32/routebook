"use client"

import { useRef } from "react"
import {
  AlertCircle,
  Download,
  Loader2,
  Maximize2,
  Route as RouteIcon,
  Trash2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ExportFormat } from "@/types/route"

interface PlanError {
  message: string
  hint?: string
  code?: string
}

interface Props {
  canPlan: boolean
  planning: boolean
  hasRoute: boolean
  onPlan: () => void
  onOverview: () => void
  onClear: () => void
  onImport?: (file: File) => void
  onExport?: (format: ExportFormat) => void
  error?: PlanError | null
}

const FORMATS: Array<{ format: ExportFormat; label: string; hint: string }> = [
  { format: "gpx", label: "GPX 1.1", hint: "码表 / 佳明" },
  { format: "tcx", label: "TCX", hint: "Strava / 佳明" },
  { format: "kml", label: "KML", hint: "地图软件" },
  { format: "csv", label: "CSV", hint: "自定义字段" },
]

/**
 * 移动端底部紧凑动作条
 * - 主按钮：「生成路线」铺开取宽，确保最关键操作一指可达
 * - 图标按钮组：全览 / 清空 / 导入 / 导出（合并 RouteActions + BottomToolbar 的功能）
 * - 错误信息折叠在主按钮上方，仅在出错时挂载
 * - 整体高度仅一行（含 Safe Area），管理点位时视觉占用最小
 */
export function MobileActionBar({
  canPlan,
  planning,
  hasRoute,
  onPlan,
  onOverview,
  onClear,
  onImport,
  onExport,
  error,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function pickFile() {
    fileInputRef.current?.click()
  }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) onImport?.(f)
    e.target.value = ""
  }

  return (
    <div
      className={cn(
        "border-t border-border bg-card",
        "px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx,.tcx,.kml,.csv,application/gpx+xml,application/vnd.google-earth.kml+xml,text/csv,text/xml,application/xml"
        className="hidden"
        onChange={onFileChange}
      />

      {error && (
        <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/8 px-2.5 py-1.5">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-destructive leading-snug break-all">
                {error.message}
                {error.code && (
                  <span className="ml-1.5 text-[10px] font-mono text-destructive/70">
                    · {error.code}
                  </span>
                )}
              </div>
              {error.hint && (
                <div className="mt-0.5 text-[11px] text-destructive/85 leading-relaxed">
                  {error.hint}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {/* 主按钮 */}
        <Button
          onClick={onPlan}
          disabled={!canPlan || planning}
          className="flex-1 h-10 text-[13px] font-medium"
        >
          {planning ? (
            <>
              <Loader2 className="size-4 mr-1.5 animate-spin" /> 规划中
            </>
          ) : (
            <>
              <RouteIcon className="size-4 mr-1.5" /> 生成路线
            </>
          )}
        </Button>

        {/* 图标按钮组 */}
        <IconButton
          aria-label="路线全览"
          onClick={onOverview}
          disabled={!hasRoute}
        >
          <Maximize2 className="size-4" />
        </IconButton>

        <IconButton
          aria-label="清空路线与点位"
          onClick={onClear}
          variant="danger"
        >
          <Trash2 className="size-4" />
        </IconButton>

        <IconButton aria-label="导入路书" onClick={pickFile}>
          <Upload className="size-4" />
        </IconButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="导出路书"
              disabled={!hasRoute}
              className={cn(
                "size-10 shrink-0 inline-flex items-center justify-center rounded-md border transition-colors",
                "border-border bg-card text-foreground hover:bg-accent",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card",
              )}
            >
              <Download className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="text-[11px]">选择导出格式</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {FORMATS.map((f) => (
              <DropdownMenuItem
                key={f.format}
                onClick={() => onExport?.(f.format)}
                className="cursor-pointer"
              >
                <span className="font-medium text-[13px]">{f.label}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{f.hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function IconButton({
  children,
  variant = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "danger"
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "size-10 shrink-0 inline-flex items-center justify-center rounded-md border transition-colors",
        "border-border bg-card text-foreground hover:bg-accent",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card",
        variant === "danger" &&
          "text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5",
        className,
      )}
    >
      {children}
    </button>
  )
}
