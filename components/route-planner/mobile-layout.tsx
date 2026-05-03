"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Bike } from "lucide-react"
import { SearchSection } from "./search-section"
import { WaypointList } from "./waypoint-list"
import { RouteActions } from "./route-actions"
import { RouteStats } from "./route-stats"
import { BottomToolbar } from "./bottom-toolbar"
import { cn } from "@/lib/utils"
import type {
  AmapPOI,
  ExportFormat,
  RoutePlanResult,
  SpeedLevel,
  Waypoint,
} from "@/types/route"

interface PlanError {
  message: string
  hint?: string
  code?: string
}

interface Props {
  waypoints: Waypoint[]
  route: RoutePlanResult | null
  planning: boolean
  planError: PlanError | null
  speedLevel: SpeedLevel
  onSpeedChange: (l: SpeedLevel) => void
  onAddPoi: (poi: AmapPOI) => void
  onRemoveWaypoint: (uid: string) => void
  onRemoveWaypoints: (uids: string[]) => void
  onReorderWaypoints: (from: number, to: number) => void
  onPlan: () => void
  onOverview: () => void
  onClear: () => void
  onImport?: (file: File) => void
  onExport?: (format: ExportFormat) => void
  /** 由父组件传入已 dynamic 引入的地图节点，确保只实例化一次 */
  mapNode: ReactNode
}

const HIDE_HEADER_AT = 24

export function MobileLayout(props: Props) {
  const addedIds = useMemo(
    () => new Set(props.waypoints.map((w) => w.poi.id)),
    [props.waypoints],
  )
  const [scrolled, setScrolled] = useState(false)

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const top = e.currentTarget.scrollTop
    if (top > HIDE_HEADER_AT && !scrolled) setScrolled(true)
    else if (top <= HIDE_HEADER_AT && scrolled) setScrolled(false)
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 标题（向下滑动时渐隐 + 收起高度） */}
      <header
        className={cn(
          "shrink-0 border-b border-border bg-card overflow-hidden",
          "transition-[max-height,opacity,transform,padding] duration-200 ease-out",
          scrolled
            ? "max-h-0 opacity-0 -translate-y-1 border-b-transparent"
            : "max-h-16 opacity-100",
        )}
        aria-hidden={scrolled}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="size-8 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
            <Bike className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight truncate">
              骑行路书制作
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
              点位管理 · 路线规划 · 文件导出
            </p>
          </div>
        </div>
      </header>

      {/* 地图区：高度固定，避免被工作区挤压；底部边线视觉分割 */}
      <div className="shrink-0 h-[38vh] min-h-[240px] max-h-[420px] flex relative border-b border-border bg-muted">
        {props.mapNode}
      </div>

      {/* 工作区：整体可滚动；search-section 浮层不影响这里 */}
      <div
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-card"
      >
        {/* 地点搜索（粘性置顶，搜索浮层在地图与工作区上方铺开） */}
        <div className="sticky top-0 z-20 bg-card">
          <SearchSection onSelect={props.onAddPoi} addedIds={addedIds} />
        </div>

        {/* 点位管理（自然撑开，不限高，不内部滚动） */}
        <WaypointList
          waypoints={props.waypoints}
          onRemove={props.onRemoveWaypoint}
          onRemoveMany={props.onRemoveWaypoints}
          onReorder={props.onReorderWaypoints}
        />

        {/* 路线操作 + 统计 */}
        <div className="border-t border-border">
          <RouteActions
            canPlan={props.waypoints.length >= 2}
            planning={props.planning}
            hasRoute={!!props.route}
            onPlan={props.onPlan}
            onOverview={props.onOverview}
            onClear={props.onClear}
            error={props.planError}
          />

          <RouteStats
            route={props.route}
            speedLevel={props.speedLevel}
            onSpeedChange={props.onSpeedChange}
          />
        </div>

        {/* 给底部 fixed 工具栏留出空间，避免最后一项被挡住 */}
        <div className="h-14" aria-hidden />
      </div>

      {/* 底部工具栏（粘底，自带 border-t / bg-card） */}
      <div className="shrink-0">
        <BottomToolbar
          hasRoute={!!props.route}
          onImport={props.onImport}
          onExport={props.onExport}
        />
      </div>
    </div>
  )
}
