"use client"

import {
  Undo2,
  Redo2,
  Layers,
  Navigation,
  RefreshCw,
  Check,
  Plus,
  Minus,
  Crosshair,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type MapLayer = "standard" | "satellite" | "terrain" | "cycling"

const LAYER_LABEL: Record<MapLayer, string> = {
  standard: "标准",
  satellite: "卫星",
  terrain: "地形",
  cycling: "骑行",
}

interface Props {
  layer: MapLayer
  onLayerChange: (l: MapLayer) => void
  onUndo?: () => void
  onRedo?: () => void
  onReload?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onLocate?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

/**
 * 顶部右侧工具栏：
 * - 移动端：垂直堆叠的纯图标按钮（图层 / 重载）
 * - 桌面端：横排，图层带文字标签
 * 撤销/重做仅在外部传入 onUndo / onRedo 时才渲染（默认未接入即隐藏）。
 */
export function MapTopToolbar({
  layer,
  onLayerChange,
  onUndo,
  onRedo,
  onReload,
  canUndo,
  canRedo,
}: Props) {
  const hasHistory = Boolean(onUndo || onRedo)

  return (
    <>
      {/* 顶部左侧：撤销 / 重做（仅在外部接入时显示，移动端默认也只在 md+ 显示） */}
      {hasHistory && (
        <div className="absolute top-3 left-3 z-10 hidden md:flex items-center bg-card border border-border rounded-md shadow-sm">
          {onUndo && (
            <ToolButton aria-label="撤销" onClick={onUndo} disabled={!canUndo}>
              <Undo2 className="size-3.5" />
            </ToolButton>
          )}
          {onUndo && onRedo && <span className="w-px h-4 bg-border" />}
          {onRedo && (
            <ToolButton aria-label="重做" onClick={onRedo} disabled={!canRedo}>
              <Redo2 className="size-3.5" />
            </ToolButton>
          )}
        </div>
      )}

      {/* 顶部右侧：图层 + 重载 —— 移动端纵向纯图标，桌面端横向带标签 */}
      <div className="absolute top-3 right-3 z-10 flex flex-col md:flex-row items-stretch md:items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={`图层：${LAYER_LABEL[layer]}`}
              className="h-9 w-9 md:h-8 md:w-auto md:px-2.5 p-0 md:p-2 text-[12px] bg-card shadow-sm"
            >
              <Layers className="size-4 md:size-3.5 md:mr-1.5" />
              <span className="hidden md:inline">{LAYER_LABEL[layer]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {(Object.keys(LAYER_LABEL) as MapLayer[]).map((l) => (
              <DropdownMenuItem
                key={l}
                onClick={() => onLayerChange(l)}
                className="text-[13px] cursor-pointer"
              >
                {LAYER_LABEL[l]}
                {layer === l && <Check className="size-3.5 ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={onReload}
          aria-label="重载"
          className="h-9 w-9 md:h-8 md:w-auto md:px-2.5 p-0 md:p-2 text-[12px] bg-card shadow-sm"
        >
          <RefreshCw className="size-4 md:size-3.5 md:mr-1.5" />
          <span className="hidden md:inline">重载</span>
        </Button>
      </div>
    </>
  )
}

/**
 * 「拉起导航」浮动主按钮，置于地图左下角。
 * - 仅在 canLaunch 为 true 时启用，否则禁用（视觉提示需要先添加点位）
 * - 海拔剖面显示时自动上移，避免被遮挡
 */
export function MapNavLaunchFab({
  onLaunch,
  canLaunch,
  elevationVisible = false,
}: {
  onLaunch?: () => void
  canLaunch: boolean
  elevationVisible?: boolean
}) {
  return (
    <div
      className={cn(
        "absolute left-3 z-10 pointer-events-none transition-[bottom] duration-200",
        elevationVisible ? "bottom-[188px]" : "bottom-3",
      )}
    >
      <Button
        type="button"
        size="sm"
        onClick={onLaunch}
        disabled={!canLaunch}
        aria-label="拉起高德导航"
        className={cn(
          "pointer-events-auto h-10 px-4 rounded-full shadow-lg",
          "bg-blue-600 hover:bg-blue-700 text-white",
          "disabled:bg-blue-600/55 disabled:text-white/85",
          "text-[13px] font-medium",
        )}
      >
        <Navigation className="size-4 mr-1.5" />
        拉起导航
      </Button>
    </div>
  )
}

export function MapZoomControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  locating = false,
  elevationVisible = false,
}: Pick<Props, "onZoomIn" | "onZoomOut" | "onLocate"> & {
  locating?: boolean
  elevationVisible?: boolean
}) {
  return (
    <>
      <div
        className={cn(
          "absolute right-3 z-10 flex flex-col bg-card border border-border rounded-md shadow-sm transition-[top] duration-200",
          elevationVisible ? "top-[35%] -translate-y-1/2" : "top-1/2 -translate-y-1/2",
        )}
      >
        <ToolButton aria-label="放大" onClick={onZoomIn}>
          <Plus className="size-3.5" />
        </ToolButton>
        <span className="h-px w-4 mx-auto bg-border" />
        <ToolButton aria-label="缩小" onClick={onZoomOut}>
          <Minus className="size-3.5" />
        </ToolButton>
      </div>

      <div
        className={cn(
          "absolute right-3 z-10 flex flex-col gap-1.5 transition-[bottom] duration-200",
          elevationVisible ? "bottom-[188px]" : "bottom-3",
        )}
      >
        <button
          type="button"
          aria-label="定位到我的位置"
          title="定位到我的位置"
          onClick={onLocate}
          disabled={locating}
          className="size-9 md:size-8 bg-card border border-border rounded-md shadow-sm hover:bg-accent disabled:opacity-70 disabled:cursor-wait flex items-center justify-center text-foreground transition-colors"
        >
          {locating ? (
            <Loader2 className="size-4 md:size-3.5 animate-spin text-blue-600" />
          ) : (
            <Crosshair className="size-4 md:size-3.5" />
          )}
        </button>
      </div>
    </>
  )
}

function ToolButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "size-9 md:size-8 flex items-center justify-center text-foreground hover:bg-accent disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors",
        className,
      )}
    >
      {children}
    </button>
  )
}
