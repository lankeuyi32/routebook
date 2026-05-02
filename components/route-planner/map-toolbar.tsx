"use client"

import { useState } from "react"
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
  Settings2,
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
  onLaunchNav?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onLocate?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export function MapTopToolbar({
  layer,
  onLayerChange,
  onUndo,
  onRedo,
  onReload,
  onLaunchNav,
  canUndo,
  canRedo,
}: Props) {
  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
      <div className="flex items-center bg-card border border-border rounded-md shadow-sm">
        <ToolButton aria-label="撤销" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="size-3.5" />
        </ToolButton>
        <span className="w-px h-4 bg-border" />
        <ToolButton aria-label="重做" onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="size-3.5" />
        </ToolButton>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-[12px] bg-card shadow-sm"
          >
            <Layers className="size-3.5 mr-1.5" />
            {LAYER_LABEL[layer]}
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
        size="sm"
        onClick={onLaunchNav}
        className="h-8 px-3 text-[12px] bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
      >
        <Navigation className="size-3.5 mr-1.5" /> 拉起导航
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onReload}
        className="h-8 px-2.5 text-[12px] bg-card shadow-sm"
      >
        <RefreshCw className="size-3.5 mr-1.5" /> 重载
      </Button>
    </div>
  )
}

export function MapZoomControls({
  onZoomIn,
  onZoomOut,
  onLocate,
}: Pick<Props, "onZoomIn" | "onZoomOut" | "onLocate">) {
  return (
    <>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col bg-card border border-border rounded-md shadow-sm">
        <ToolButton aria-label="放大" onClick={onZoomIn}>
          <Plus className="size-3.5" />
        </ToolButton>
        <span className="h-px w-4 mx-auto bg-border" />
        <ToolButton aria-label="缩小" onClick={onZoomOut}>
          <Minus className="size-3.5" />
        </ToolButton>
      </div>

      <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="定位"
          onClick={onLocate}
          className="size-8 bg-card border border-border rounded-md shadow-sm hover:bg-accent flex items-center justify-center text-foreground"
        >
          <Crosshair className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="设置"
          className="size-8 bg-card border border-border rounded-md shadow-sm hover:bg-accent flex items-center justify-center text-foreground"
        >
          <Settings2 className="size-3.5" />
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
        "size-8 flex items-center justify-center text-foreground hover:bg-accent disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors",
        className,
      )}
    >
      {children}
    </button>
  )
}
