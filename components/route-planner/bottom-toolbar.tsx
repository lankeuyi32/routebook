"use client"

import { useRef } from "react"
import { Upload, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ExportFormat } from "@/types/route"

interface Props {
  hasRoute: boolean
  /** 用户选中本地文件后回调，已读取为 File 对象 */
  onImport?: (file: File) => void
  onExport?: (format: ExportFormat) => void
}

const FORMATS: Array<{ format: ExportFormat; label: string; hint: string }> = [
  { format: "gpx", label: "GPX 1.1", hint: "码表 / 佳明" },
  { format: "tcx", label: "TCX", hint: "Strava / 佳明" },
  { format: "kml", label: "KML", hint: "地图软件" },
  { format: "csv", label: "CSV", hint: "自定义字段" },
]

export function BottomToolbar({ hasRoute, onImport, onExport }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handlePickFile() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onImport?.(file)
    // 重置 value 让用户能再次选同一个文件
    e.target.value = ""
  }

  return (
    <div className="border-t border-border px-4 py-3 bg-card pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {/* 隐藏的文件选择器，由「导入」按钮触发 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx,.tcx,.kml,.csv,application/gpx+xml,application/vnd.google-earth.kml+xml,text/csv,text/xml,application/xml"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={handlePickFile}
          className="h-10 text-[13px] font-medium"
        >
          <Upload className="size-4 mr-1.5" /> 导入路书
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={!hasRoute}
              className="h-10 text-[13px] font-medium w-full"
            >
              <Download className="size-4 mr-1.5" /> 导出路书
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
