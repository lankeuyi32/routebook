"use client"

import { useMemo } from "react"
import { Bike } from "lucide-react"
import { SearchSection } from "./search-section"
import { WaypointList } from "./waypoint-list"
import { RouteActions } from "./route-actions"
import { RouteStats } from "./route-stats"
import { BottomToolbar } from "./bottom-toolbar"
import { SiteFooter } from "./site-footer"
import type { AmapPOI, ExportFormat, RoutePlanResult, SpeedLevel, Waypoint } from "@/types/route"

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
}

export function LeftPanel(props: Props) {
  const addedIds = useMemo(() => new Set(props.waypoints.map((w) => w.poi.id)), [props.waypoints])

  return (
    <aside
      className={[
        // 响应式宽度：移动 280 → 平板 320 → 笔记本 360 → 桌面 400 → 大屏 440
        "w-[280px] sm:w-[320px] md:w-[360px] xl:w-[400px] 2xl:w-[440px]",
        "shrink-0 flex flex-col border-r border-border bg-card h-screen overflow-hidden",
      ].join(" ")}
    >
      {/* 顶部品牌区 */}
      <header className="px-4 py-3.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
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

      {/* 地点搜索（输入框紧凑固定，结果以浮层形式叠加在下方区域上） */}
      <div className="shrink-0 relative z-20">
        <SearchSection onSelect={props.onAddPoi} addedIds={addedIds} />
      </div>

      {/* 点位管理（弹性高度，最少 200px 保证 3-4 条可见，内部独立滚动） */}
      <WaypointList
        className="flex-1 min-h-[200px]"
        waypoints={props.waypoints}
        onRemove={props.onRemoveWaypoint}
        onRemoveMany={props.onRemoveWaypoints}
        onReorder={props.onReorderWaypoints}
      />

      {/* 路线操作 + 统计（最大 38vh，超过自身滚动） */}
      <div className="shrink-0 max-h-[38vh] overflow-y-auto border-t border-border">
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

      {/* 底部工具栏 */}
      <BottomToolbar
        hasRoute={!!props.route}
        onImport={props.onImport}
        onExport={props.onExport}
      />

      {/* 全站页脚（版权 / 关于 / GitHub） */}
      <SiteFooter />
    </aside>
  )
}
