"use client"

import { Compass, Upload, Download } from "lucide-react"
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
  onImport?: () => void
  onExport?: (format: ExportFormat) => void
}

const FORMATS: Array<{ format: ExportFormat; label: string; hint: string }> = [
  { format: "gpx", label: "GPX 1.1", hint: "码表 / 佳明" },
  { format: "tcx", label: "TCX", hint: "Strava / 佳明" },
  { format: "kml", label: "KML", hint: "地图软件" },
  { format: "csv", label: "CSV", hint: "自定义字段" },
]

export function BottomToolbar({ hasRoute, onImport, onExport }: Props) {
  return (
    <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-card">
      <button
        type="button"
        className="size-9 rounded-full border border-border bg-card hover:bg-accent flex flex-col items-center justify-center text-foreground transition-colors"
        aria-label="指南针"
      >
        <Compass className="size-3.5" />
        <span className="text-[8px] font-medium leading-none mt-0.5">N</span>
      </button>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onImport}
          className="h-9 px-3 text-[12px]"
        >
          <Upload className="size-3.5 mr-1.5" /> 导入
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasRoute}
              className="h-9 px-3 text-[12px]"
            >
              <Download className="size-3.5 mr-1.5" /> 导出
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
