"use client"

import { useState } from "react"
import { GripVertical, Trash2, X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import type { Waypoint } from "@/types/route"
import { cn } from "@/lib/utils"

interface Props {
  waypoints: Waypoint[]
  onRemove: (uid: string) => void
  onRemoveMany: (uids: string[]) => void
  onReorder: (from: number, to: number) => void
}

const ROLE_LABEL: Record<Waypoint["role"], string> = {
  start: "起点",
  via: "途经",
  end: "终点",
}

const ROLE_STYLE: Record<Waypoint["role"], string> = {
  start: "bg-foreground text-background",
  via: "bg-secondary text-secondary-foreground",
  end: "bg-blue-600 text-white",
}

export function WaypointList({ waypoints, onRemove, onRemoveMany, onReorder }: Props) {
  const [batchMode, setBatchMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function toggleSelect(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function selectAll() {
    if (selected.size === waypoints.length) setSelected(new Set())
    else setSelected(new Set(waypoints.map((w) => w.uid)))
  }

  function handleBatchDelete() {
    if (selected.size === 0) return
    onRemoveMany(Array.from(selected))
    setSelected(new Set())
    setBatchMode(false)
  }

  function handleDragStart(idx: number) {
    setDragIndex(idx)
  }
  function handleDragOver(idx: number, e: React.DragEvent) {
    e.preventDefault()
    setOverIndex(idx)
  }
  function handleDrop(idx: number) {
    if (dragIndex !== null && dragIndex !== idx) onReorder(dragIndex, idx)
    setDragIndex(null)
    setOverIndex(null)
  }

  const start = waypoints[0]
  const end = waypoints.length >= 2 ? waypoints[waypoints.length - 1] : null

  return (
    <section className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">点位管理</h2>
          <span className="text-[11px] text-muted-foreground">
            共 {waypoints.length} 个
          </span>
        </div>
        {waypoints.length > 0 && (
          <Button
            size="sm"
            variant={batchMode ? "secondary" : "default"}
            onClick={() => {
              setBatchMode((b) => !b)
              setSelected(new Set())
            }}
            className="h-7 px-2.5 text-[11px]"
          >
            {batchMode ? "退出" : "批量"}
          </Button>
        )}
      </div>

      {batchMode && waypoints.length > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-md bg-secondary px-2.5 py-1.5">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selected.size === waypoints.length && waypoints.length > 0}
              onCheckedChange={selectAll}
              aria-label="全选"
            />
            <span className="text-[11px] text-muted-foreground">
              已选 <span className="text-foreground font-medium">{selected.size}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={handleBatchDelete}
              disabled={selected.size === 0}
              className="h-7 px-2.5 text-[11px] bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"
            >
              <Trash2 className="size-3 mr-1" />
              删除
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBatchMode(false)
                setSelected(new Set())
              }}
              className="h-7 px-2 text-[11px]"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {waypoints.length === 0 ? (
        <Empty className="border-dashed border border-border rounded-md py-6">
          <EmptyHeader>
            <EmptyTitle className="text-[13px]">还没有点位</EmptyTitle>
            <EmptyDescription className="text-[11px]">
              通过上方搜索添加你的第一个点位
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="space-y-1.5">
          {waypoints.map((w, idx) => (
            <li
              key={w.uid}
              draggable={!batchMode}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(idx, e)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
              className={cn(
                "group flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2 transition-all",
                dragIndex === idx && "opacity-40",
                overIndex === idx && dragIndex !== idx && "border-foreground",
              )}
            >
              {batchMode ? (
                <Checkbox
                  checked={selected.has(w.uid)}
                  onCheckedChange={() => toggleSelect(w.uid)}
                  className="ml-0.5"
                />
              ) : (
                <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                  <GripVertical className="size-4" />
                </div>
              )}

              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    ROLE_STYLE[w.role],
                  )}
                >
                  {ROLE_LABEL[w.role]}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-foreground truncate">
                  {w.poi.name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {w.poi.address}
                </div>
              </div>

              {!batchMode && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(w.uid)}
                  className="size-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  aria-label="删除点位"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {start && end && (
        <div className="mt-3 rounded-md bg-secondary px-3 py-2 flex items-center gap-2 text-[12px]">
          <span className="size-1.5 rounded-full bg-foreground shrink-0" />
          <span className="truncate font-medium">{start.poi.name}</span>
          <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
          <span className="size-1.5 rounded-full bg-blue-600 shrink-0" />
          <span className="truncate font-medium">{end.poi.name}</span>
        </div>
      )}
    </section>
  )
}
