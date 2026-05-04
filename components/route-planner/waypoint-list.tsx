"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { GripVertical, Trash2, X, ArrowRight, Search, Replace } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import type { Waypoint } from "@/types/route"
import { cn } from "@/lib/utils"

interface Props {
  waypoints: Waypoint[]
  onRemove: (uid: string) => void
  onRemoveMany: (uids: string[]) => void
  onReorder: (from: number, to: number) => void
  /**
   * 长按选中后再点击另一项时调用，用于"置换"两个点位的位置。
   * 未提供时回退到 onReorder（移动语义）。
   */
  onSwap?: (a: number, b: number) => void
  className?: string
  /**
   * 列表内部滚动区的最大高度（Tailwind 类名）。
   * 用于桌面端可选限高；移动端建议改用 fillAvailable。
   */
  listMaxHeightClass?: string
  /**
   * 让列表区在 section 内 flex-1 撑满 + 内部滚动，section 自身需要被父级给到一个有限高度。
   * 移动端传 true，使整个工作区只产生一个上下滚动的列表区。
   */
  fillAvailable?: boolean
  /**
   * 紧凑搜索：搜索框默认折叠为「批量」左边的图标按钮，点击后才展开输入框。
   * 移动端传 true 以释放点位管理标题区的纵向空间。
   */
  compactSearch?: boolean
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

export function WaypointList({
  waypoints,
  onRemove,
  onRemoveMany,
  onReorder,
  onSwap,
  className,
  listMaxHeightClass,
  fillAvailable = false,
  compactSearch = false,
}: Props) {
  const [batchMode, setBatchMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [filterKw, setFilterKw] = useState("")
  // 紧凑模式下，搜索输入框的展开状态（默认折叠为图标按钮）
  const [searchExpanded, setSearchExpanded] = useState(false)
  const showSearchInput = !compactSearch || searchExpanded
  // 长按交换：被长按选中的项 index；再点击另一项即触发置换
  const [swapPickIndex, setSwapPickIndex] = useState<number | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)

  // 退出批量模式或开启筛选时，清空交换状态，避免脏态
  useEffect(() => {
    if (batchMode || filterKw) setSwapPickIndex(null)
  }, [batchMode, filterKw])

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  function startLongPress(idx: number) {
    if (batchMode || filterKw) return
    clearLongPressTimer()
    longPressTriggeredRef.current = false
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      setSwapPickIndex(idx)
      // 触觉反馈（在支持的设备上提供 10ms 短震，作为"已进入交换模式"的提示）
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(10)
      }
    }, 450)
  }

  function handleItemClick(idx: number) {
    if (batchMode) return
    if (swapPickIndex === null) return
    // 二次点击同一项 => 取消交换模式
    if (swapPickIndex === idx) {
      setSwapPickIndex(null)
      return
    }
    // 触发置换：优先调用 onSwap，未提供时回退到 onReorder（移动语义）
    if (onSwap) onSwap(swapPickIndex, idx)
    else onReorder(swapPickIndex, idx)
    setSwapPickIndex(null)
  }

  // 过滤后的点位（保持原始顺序与 index）
  const filtered = useMemo(() => {
    const kw = filterKw.trim().toLowerCase()
    if (!kw) return waypoints.map((w, idx) => ({ w, idx }))
    return waypoints
      .map((w, idx) => ({ w, idx }))
      .filter(
        ({ w }) =>
          w.poi.name.toLowerCase().includes(kw) ||
          w.poi.address.toLowerCase().includes(kw) ||
          (w.poi.cityname?.toLowerCase().includes(kw) ?? false) ||
          (w.poi.adname?.toLowerCase().includes(kw) ?? false),
      )
  }, [waypoints, filterKw])

  function toggleSelect(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(({ w }) => w.uid)))
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
  const isFiltering = filterKw.trim().length > 0
  // 处于"长按选中等待置换"状态时也禁用 HTML5 拖拽，避免在触屏上误触发系统级拖动
  const dragDisabled = batchMode || isFiltering || swapPickIndex !== null

  return (
    <section className={cn("flex flex-col border-t border-border", className)}>
      {/* Header（固定） */}
      <div className={cn("shrink-0 px-4", compactSearch ? "py-2" : "py-3")}>
        <div className={cn("flex items-center justify-between", compactSearch ? "mb-1.5" : "mb-2.5")}>
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-medium text-foreground">点位管理</h2>
            <span className="text-[11px] text-muted-foreground shrink-0">
              共 {waypoints.length} 个
              {isFiltering && (
                <span className="ml-1 text-foreground">/ 筛 {filtered.length}</span>
              )}
            </span>
          </div>

          {waypoints.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 紧凑模式：搜索图标按钮（在「批量」左侧），点击切换输入框展开 */}
              {compactSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchExpanded((v) => {
                      // 收起时一并清空筛选条件，避免列表保留旧过滤态
                      if (v) setFilterKw("")
                      return !v
                    })
                  }}
                  aria-label={searchExpanded ? "收起筛选" : "筛选点位"}
                  aria-pressed={searchExpanded}
                  className={cn(
                    "h-7 w-7 inline-flex items-center justify-center rounded-md border transition-colors",
                    searchExpanded || isFiltering
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-foreground border-border hover:bg-accent",
                  )}
                >
                  <Search className="size-3.5" />
                </button>
              )}

              <Button
                size="sm"
                variant={batchMode ? "secondary" : "default"}
                onClick={() => {
                  setBatchMode((b) => !b)
                  setSelected(new Set())
                }}
                className="h-7 px-2.5 text-[11px] shrink-0"
              >
                {batchMode ? "退出" : "批量"}
              </Button>
            </div>
          )}
        </div>

        {/* 列表过滤搜索：非紧凑模式始终显示；紧凑模式由图标按钮切换展开 */}
        {waypoints.length > 0 && showSearchInput && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              autoFocus={compactSearch && searchExpanded}
              value={filterKw}
              onChange={(e) => setFilterKw(e.target.value)}
              placeholder="筛选点位名称 / 地址 / 城区"
              className="h-8 pl-8 pr-8 text-[12px]"
            />
            {filterKw && (
              <button
                type="button"
                onClick={() => setFilterKw("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="清除筛选"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {batchMode && waypoints.length > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-md bg-secondary px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === filtered.length && filtered.length > 0}
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
      </div>

      {/* 长按交换模式提示条（仅在选中等待目标时显示） */}
      {swapPickIndex !== null && (
        <div className="mx-4 mb-1.5 shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] text-blue-700">
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <Replace className="size-3.5 shrink-0" />
            <span className="truncate">
              已选中
              <span className="mx-1 font-mono font-medium">
                {String(swapPickIndex + 1).padStart(2, "0")}
              </span>
              · 点击另一项以置换位置
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSwapPickIndex(null)}
            className="shrink-0 inline-flex items-center justify-center size-5 rounded hover:bg-blue-100"
            aria-label="取消交换"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* 列表区：
          - fillAvailable=true（移动端）→ 在 section 内 flex-1 撑满 + 内部滚动，是工作区唯一的滚动容器；
          - listMaxHeightClass 提供 → 限高 + 内部滚动；
          - 都未提供 → 自然撑开，由更外层容器统一滚动 */}
      <div
        className={cn(
          "px-4 pb-2",
          (fillAvailable || listMaxHeightClass) &&
            "flex-1 min-h-0 overflow-y-auto overscroll-contain",
          listMaxHeightClass,
        )}
      >
        {waypoints.length === 0 ? (
          <Empty className="border-dashed border border-border rounded-md py-6">
            <EmptyHeader>
              <EmptyTitle className="text-[13px]">还没有点位</EmptyTitle>
              <EmptyDescription className="text-[11px]">
                通过上方搜索或地图点选添加第一个点位
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6 text-[12px] text-muted-foreground">
            没有匹配 &ldquo;{filterKw}&rdquo; 的点位
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map(({ w, idx }) => (
              <li
                key={w.uid}
                draggable={!dragDisabled}
                onDragStart={() => !dragDisabled && handleDragStart(idx)}
                onDragOver={(e) => !dragDisabled && handleDragOver(idx, e)}
                onDrop={() => !dragDisabled && handleDrop(idx)}
                onDragEnd={() => {
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                // 触屏长按 ~450ms 进入交换模式，再点另一项即置换
                onTouchStart={() => startLongPress(idx)}
                onTouchEnd={() => {
                  clearLongPressTimer()
                  // 如果长按已经触发，本次 touch 不算"点击"，下次再点其他项才置换
                  if (longPressTriggeredRef.current) {
                    longPressTriggeredRef.current = false
                  }
                }}
                onTouchMove={() => clearLongPressTimer()}
                onTouchCancel={() => clearLongPressTimer()}
                onClick={() => handleItemClick(idx)}
                className={cn(
                  "group flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2 transition-all",
                  dragIndex === idx && "opacity-40",
                  overIndex === idx && dragIndex !== idx && "border-foreground",
                  // 长按选中状态：高亮背景 + 蓝边
                  swapPickIndex === idx && "border-blue-500 bg-blue-50",
                  // 处于交换模式时，未被选中的项视觉提示为"可点击交换目标"
                  swapPickIndex !== null && swapPickIndex !== idx && "cursor-pointer",
                )}
              >
                {batchMode ? (
                  <Checkbox
                    checked={selected.has(w.uid)}
                    onCheckedChange={() => toggleSelect(w.uid)}
                    className="ml-0.5"
                  />
                ) : (
                  <div
                    className={cn(
                      "text-muted-foreground hover:text-foreground",
                      dragDisabled
                        ? "cursor-not-allowed opacity-40"
                        : "cursor-grab active:cursor-grabbing",
                    )}
                    title={isFiltering ? "筛选状态下无法拖拽排序" : "拖拽排序"}
                  >
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
      </div>

      {/* 起→终点预览（固定在地点管理底部）：
          - 紧凑模式（手机端）显示「点1 → 点N」序号化短文字；
          - 桌面端保持原有的「真实名字」格式。 */}
      {start && compactSearch && (
        <div className="mx-4 mb-3 mt-1 shrink-0 rounded-full bg-secondary px-3 py-1.5 inline-flex self-start items-center gap-2 text-[12px]">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-foreground" />
            <span className="font-medium text-foreground tabular-nums">点 1</span>
          </span>
          {end && (
            <>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-blue-600" />
                <span className="font-medium text-blue-700 tabular-nums">
                  点 {waypoints.length}
                </span>
              </span>
            </>
          )}
        </div>
      )}
      {start && end && !compactSearch && (
        <div className="mx-4 mb-3 mt-1 rounded-md bg-secondary px-3 py-2 flex items-center gap-2 text-[12px] shrink-0">
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
