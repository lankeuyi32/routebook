"use client"

/**
 * 拉起导航前的「起 / 终点选择」对话框
 *
 * - 默认起点 = 第一个点位，终点 = 最后一个点位
 * - 必须两点不同；高德骑行不支持途经点，会用提示告知用户
 * - 通过 onConfirm(fromIdx, toIdx) 把所选索引交回父组件实际拉起导航
 */

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, MapPin, Navigation } from "lucide-react"
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  waypoints: Waypoint[]
  /** 用户确认后回调：传出起点索引、终点索引 */
  onConfirm: (fromIdx: number, toIdx: number) => void
}

/** 把点位渲染成「序号 + 名称」便于在下拉中识别 */
function formatLabel(w: Waypoint, idx: number) {
  const name = w.poi.name?.trim() || w.poi.address?.trim() || `(无名点位)`
  return `${String(idx + 1).padStart(2, "0")} · ${name}`
}

export function NavLaunchDialog({ open, onOpenChange, waypoints, onConfirm }: Props) {
  const lastIdx = Math.max(0, waypoints.length - 1)

  // 默认：起点=0，终点=最后一个
  const [fromIdx, setFromIdx] = useState(0)
  const [toIdx, setToIdx] = useState(lastIdx)

  // 每次打开对话框，根据当前点位列表重置默认值
  useEffect(() => {
    if (open) {
      setFromIdx(0)
      setToIdx(lastIdx)
    }
  }, [open, lastIdx])

  const fromWp = waypoints[fromIdx]
  const toWp = waypoints[toIdx]

  // 起终点之间是否存在被忽略的途经点
  const ignoredCount = useMemo(() => {
    if (fromIdx === toIdx) return 0
    const lo = Math.min(fromIdx, toIdx)
    const hi = Math.max(fromIdx, toIdx)
    return Math.max(0, hi - lo - 1)
  }, [fromIdx, toIdx])

  const sameSelection = fromIdx === toIdx
  const canConfirm = waypoints.length >= 2 && !sameSelection

  function handleConfirm() {
    if (!canConfirm) return
    onConfirm(fromIdx, toIdx)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="size-4 text-blue-600" />
            选择导航起点与终点
          </DialogTitle>
          <DialogDescription>
            高德骑行导航仅支持起点与终点两个位置，途经点会被忽略。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
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

          {/* 预览：所选起 → 终 */}
          {fromWp && toWp && !sameSelection && (
            <div className="rounded-md border border-border bg-secondary/60 px-3 py-2 text-[12px]">
              <div className="flex items-start gap-2">
                <MapPin className="size-3.5 text-foreground shrink-0 mt-0.5" />
                <span className="truncate font-medium">{fromWp.poi.name}</span>
              </div>
              <div className="flex items-center justify-center my-1">
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

          {/* 提示：途经点会被忽略 */}
          {ignoredCount > 0 && !sameSelection && (
            <p className="text-[11px] text-muted-foreground">
              所选起 / 终点之间有 {ignoredCount} 个点位将被忽略（高德骑行不支持途经点）。
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
            <Navigation className="size-4 mr-1.5" />
            拉起导航
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
