"use client"

/**
 * 拉起导航前的「方式 / 起 / 终点选择」对话框
 *
 * - 支持两种导航方式：
 *   - 骑行（ride）：仅起 + 终，途经点会被忽略（高德骑行限制）
 *   - 驾车（car） ：依次途经所有中间点；高德 URI 单次最多承载 16 个途经点，
 *                   超出部分由 lib/launch-nav.ts 在唤起时静默截断，网页侧不做限制 / 提示
 * - 默认起点 = 第一个点位，终点 = 最后一个点位
 * - 必须两点不同
 * - 通过 onConfirm({ mode, fromIdx, toIdx }) 把所选交回父组件实际拉起导航
 */

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Bike, Car, MapPin, Navigation } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Waypoint } from "@/types/route"
import type { NavMode } from "@/lib/launch-nav"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  waypoints: Waypoint[]
  /** 用户确认后回调：传出导航方式、起点索引、终点索引 */
  onConfirm: (args: { mode: NavMode; fromIdx: number; toIdx: number }) => void
}

/** 把点位渲染成「序号 + 名称」便于在下拉中识别 */
function formatLabel(w: Waypoint, idx: number) {
  const name = w.poi.name?.trim() || w.poi.address?.trim() || `(无名点位)`
  return `${String(idx + 1).padStart(2, "0")} · ${name}`
}

export function NavLaunchDialog({ open, onOpenChange, waypoints, onConfirm }: Props) {
  const lastIdx = Math.max(0, waypoints.length - 1)

  // 默认：骑行 / 起点=0 / 终点=最后一个
  const [mode, setMode] = useState<NavMode>("ride")
  const [fromIdx, setFromIdx] = useState(0)
  const [toIdx, setToIdx] = useState(lastIdx)

  // 每次打开对话框，根据当前点位列表重置默认值
  useEffect(() => {
    if (open) {
      setMode("ride")
      setFromIdx(0)
      setToIdx(lastIdx)
    }
  }, [open, lastIdx])

  const fromWp = waypoints[fromIdx]
  const toWp = waypoints[toIdx]

  // 起 → 终之间的中间点（按"沿用户选择方向"排列）
  const middleWaypoints = useMemo(() => {
    if (fromIdx === toIdx) return [] as Array<{ w: Waypoint; idx: number }>
    if (fromIdx < toIdx) {
      return waypoints
        .slice(fromIdx + 1, toIdx)
        .map((w, k) => ({ w, idx: fromIdx + 1 + k }))
    }
    // 反向：从大索引向小索引
    const rev: Array<{ w: Waypoint; idx: number }> = []
    for (let i = fromIdx - 1; i > toIdx; i--) {
      rev.push({ w: waypoints[i], idx: i })
    }
    return rev
  }, [waypoints, fromIdx, toIdx])

  const sameSelection = fromIdx === toIdx
  const canConfirm = waypoints.length >= 2 && !sameSelection

  function handleConfirm() {
    if (!canConfirm) return
    onConfirm({ mode, fromIdx, toIdx })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="size-4 text-blue-600" />
            选择导航方式
          </DialogTitle>
          <DialogDescription>
            {mode === "ride"
              ? "高德骑行导航仅支持起点与终点两个位置，途经点会被忽略。"
              : "驾车导航将依次途经你选择的中间点。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* 导航方式：骑行 / 驾车 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("ride")}
              aria-pressed={mode === "ride"}
              className={cn(
                "h-10 rounded-md border text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
                mode === "ride"
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-card border-border text-foreground hover:bg-accent",
              )}
            >
              <Bike className="size-4" />
              骑行
            </button>
            <button
              type="button"
              onClick={() => setMode("car")}
              aria-pressed={mode === "car"}
              className={cn(
                "h-10 rounded-md border text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
                mode === "car"
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-card border-border text-foreground hover:bg-accent",
              )}
            >
              <Car className="size-4" />
              驾车
            </button>
          </div>

          {/* 起点 */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-foreground" />
              起点
            </label>
            <Select
              value={String(fromIdx)}
              onValueChange={(v) => setFromIdx(Number(v))}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue placeholder="选择起点" />
              </SelectTrigger>
              <SelectContent>
                {waypoints.map((w, i) => (
                  <SelectItem
                    key={w.uid}
                    value={String(i)}
                    disabled={i === toIdx}
                    className="text-[13px]"
                  >
                    {formatLabel(w, i)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 终点 */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-600" />
              终点
            </label>
            <Select
              value={String(toIdx)}
              onValueChange={(v) => setToIdx(Number(v))}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue placeholder="选择终点" />
              </SelectTrigger>
              <SelectContent>
                {waypoints.map((w, i) => (
                  <SelectItem
                    key={w.uid}
                    value={String(i)}
                    disabled={i === fromIdx}
                    className="text-[13px]"
                  >
                    {formatLabel(w, i)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 预览 */}
          {fromWp && toWp && !sameSelection && (
            <div className="rounded-md border border-border bg-secondary/60 px-3 py-2 text-[12px] space-y-1">
              <div className="flex items-start gap-2">
                <MapPin className="size-3.5 text-foreground shrink-0 mt-0.5" />
                <span className="truncate font-medium">{fromWp.poi.name}</span>
              </div>

              {/* 驾车：列出实际经过的途经点（网页侧不做截断；超出 16 的部分由唤起时静默丢弃） */}
              {mode === "car" &&
                middleWaypoints.map(({ w, idx }) => (
                  <div key={w.uid} className="flex items-start gap-2 pl-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
                    <span className="truncate text-muted-foreground">
                      <span className="tabular-nums">{String(idx + 1).padStart(2, "0")}</span>
                      <span className="mx-1">·</span>
                      {w.poi.name}
                    </span>
                  </div>
                ))}

              <div className="flex items-center justify-center py-0.5">
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="size-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span className="truncate font-medium">{toWp.poi.name}</span>
              </div>
            </div>
          )}

          {/* 错误：起终点相同 */}
          {sameSelection && (
            <p className="text-[12px] text-destructive">起点与终点不能为同一位置。</p>
          )}

          {/* 提示文案 */}
          {!sameSelection && mode === "ride" && middleWaypoints.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              所选起 / 终点之间有 {middleWaypoints.length} 个点位将被忽略（高德骑行不支持途经点）。
            </p>
          )}
          {!sameSelection && mode === "car" && middleWaypoints.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              将依次途经 {middleWaypoints.length} 个点位。
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className={cn(
              "h-9 bg-blue-600 hover:bg-blue-700 text-white",
              "disabled:bg-blue-600/55 disabled:text-white/85",
            )}
          >
            {mode === "ride" ? <Bike className="size-4 mr-1.5" /> : <Car className="size-4 mr-1.5" />}
            {mode === "ride" ? "拉起骑行导航" : "拉起驾车导航"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
