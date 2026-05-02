"use client"

import { useMemo } from "react"
import { Bike } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SearchSection } from "./search-section"
import { WaypointList } from "./waypoint-list"
import { RouteActions } from "./route-actions"
import { RouteStats } from "./route-stats"
import { BottomToolbar } from "./bottom-toolbar"
import type { AmapPOI, ExportFormat, RoutePlanResult, SpeedLevel, Waypoint } from "@/types/route"

interface Props {
  waypoints: Waypoint[]
  route: RoutePlanResult | null
  planning: boolean
  planError: string | null
  speedLevel: SpeedLevel
  onSpeedChange: (l: SpeedLevel) => void
  onAddPoi: (poi: AmapPOI) => void
  onRemoveWaypoint: (uid: string) => void
  onRemoveWaypoints: (uids: string[]) => void
  onReorderWaypoints: (from: number, to: number) => void
  onPlan: () => void
  onOverview: () => void
  onClear: () => void
  onImport?: () => void
  onExport?: (format: ExportFormat) => void
}

export function LeftPanel(props: Props) {
  const addedIds = useMemo(() => new Set(props.waypoints.map((w) => w.poi.id)), [props.waypoints])

  return (
    <aside className="w-[380px] shrink-0 flex flex-col border-r border-border bg-card h-screen">
      <header className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-foreground text-background flex items-center justify-center">
            <Bike className="size-4" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">
              骑行路书制作
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              点位管理 · 路线规划 · 文件导出
            </p>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <SearchSection onSelect={props.onAddPoi} addedIds={addedIds} />

        <WaypointList
          waypoints={props.waypoints}
          onRemove={props.onRemoveWaypoint}
          onRemoveMany={props.onRemoveWaypoints}
          onReorder={props.onReorderWaypoints}
        />

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
      </ScrollArea>

      <BottomToolbar
        hasRoute={!!props.route}
        onImport={props.onImport}
        onExport={props.onExport}
      />
    </aside>
  )
}
