"use client"

import { useState } from "react"
import { LeftPanel } from "@/components/route-planner/left-panel"
import { MapView } from "@/components/route-planner/map-view"
import { useRoutePlanner } from "@/hooks/use-route-planner"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import type { ExportFormat } from "@/types/route"

export default function Page() {
  const planner = useRoutePlanner()
  const [overviewSignal, setOverviewSignal] = useState(0)

  function handleExport(format: ExportFormat) {
    // 真实导出逻辑应在 services/export.ts 中实现，并基于 planner.route.path 与 planner.elevation 生成文件
    toast.message(`导出 ${format.toUpperCase()}`, {
      description: "导出功能将在接入后端后启用",
    })
  }

  function handleImport() {
    toast.message("导入文件", { description: "支持 GPX / TCX / KML（接入后端后启用）" })
  }

  function handleOverview() {
    setOverviewSignal((s) => s + 1)
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <LeftPanel
        waypoints={planner.waypoints}
        route={planner.route}
        planning={planner.planning}
        planError={planner.planError}
        speedLevel={planner.speedLevel}
        onSpeedChange={planner.setSpeedLevel}
        onAddPoi={planner.addWaypoint}
        onRemoveWaypoint={planner.removeWaypoint}
        onRemoveWaypoints={planner.removeWaypoints}
        onReorderWaypoints={planner.reorderWaypoints}
        onPlan={planner.planRoute}
        onOverview={handleOverview}
        onClear={planner.clearAll}
        onImport={handleImport}
        onExport={handleExport}
      />

      <MapView
        waypoints={planner.waypoints}
        route={planner.route}
        elevation={planner.elevation}
        overviewSignal={overviewSignal}
      />

      <Toaster position="top-center" />
    </main>
  )
}
