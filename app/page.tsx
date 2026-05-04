"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import { LeftPanel } from "@/components/route-planner/left-panel"
import { MobileLayout } from "@/components/route-planner/mobile-layout"
import { useRoutePlanner } from "@/hooks/use-route-planner"
import { useIsMobile } from "@/hooks/use-mobile"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { parseRouteFile } from "@/lib/import-route"
import type { ExportFormat, AmapPOI } from "@/types/route"

// 动态加载真实地图组件，禁用 SSR（@amap/amap-jsapi-loader 依赖浏览器 window）
const AMapView = dynamic(
  () => import("@/components/route-planner/amap-view").then((m) => m.AMapView),
  {
    ssr: false,
    loading: () => (
      <div className="relative flex-1 min-w-0 h-full flex items-center justify-center bg-muted">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          正在加载地图…
        </div>
      </div>
    ),
  },
)

export default function Page() {
  const planner = useRoutePlanner()
  const [overviewSignal, setOverviewSignal] = useState(0)
  const isMobile = useIsMobile()

  // 路线规划错误时弹出含修复建议的 toast
  useEffect(() => {
    if (!planner.planError) return
    toast.error(planner.planError.message, {
      description: planner.planError.hint,
      duration: 8000,
    })
  }, [planner.planError])

  function handleExport(format: ExportFormat) {
    // 真实导出逻辑应在 services/export.ts 中实现，并基于 planner.route.path 与 planner.elevation 生成文件
    toast.message(`导出 ${format.toUpperCase()}`, {
      description: "导出功能将在接入后端后启用",
    })
  }

  async function handleImport(file: File) {
    const tid = toast.loading("正在解析文件…", { description: file.name })
    try {
      const result = await parseRouteFile(file)
      planner.addWaypoints(result.pois)
      toast.success(`已导入 ${result.pois.length} 个点位`, {
        id: tid,
        description: result.notice
          ? `${result.format.toUpperCase()} · ${result.name ?? file.name} · ${result.notice}`
          : `${result.format.toUpperCase()} · ${result.name ?? file.name}`,
        duration: 6000,
      })
      // 自动让地图全览到导入的点位
      setOverviewSignal((s) => s + 1)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "文件解析失败"
      toast.error("导入失败", { id: tid, description: msg, duration: 8000 })
    }
  }

  function handleOverview() {
    setOverviewSignal((s) => s + 1)
  }

  /**
   * 「重载」按钮：智能行为
   * - ≥2 个点位：重新发起骑行路线规划（最常见诉求：改了点位顺序/数量后一键重算）
   * - 不足 2 点：toast 提示，并触发地图全览作为兜底视觉反馈
   */
  async function handleReload() {
    if (planner.planning) {
      toast.info("正在规划路线…")
      return
    }
    if (planner.waypoints.length < 2) {
      toast.error("至少需要两个点位才能重新规划路线")
      setOverviewSignal((s) => s + 1)
      return
    }
    const tid = toast.loading("正在重新规划路线…")
    // 用 planRoute 的返回值判断成败，避免读到闭包旧的 planError
    const result = await planner.planRoute()
    if (result.ok) {
      toast.success("路线已重新规划", { id: tid })
    } else {
      // planError useEffect 会另外弹一条详细错误 toast；这里只关掉 loading
      toast.dismiss(tid)
    }
  }

  /** 清空全部点位与路线（带确认） */
  function handleClear() {
    if (planner.waypoints.length === 0 && !planner.route) {
      planner.clearAll()
      return
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `确定要清空全部 ${planner.waypoints.length} 个点位和当前路线吗？此操作不可撤销`,
      )
    ) {
      return
    }
    planner.clearAll()
    toast.message("已清空路线")
  }

  // 地图节点（桌面 / 移动两种布局共用同一份实例，避免双倍 JS API 加载）
  // 移动端把海拔剖面外移到搜索栏与地图之间，所以传 hideElevation
  const mapNode = (
    <AMapView
      waypoints={planner.waypoints}
      route={planner.route}
      elevation={planner.elevation}
      overviewSignal={overviewSignal}
      onReload={handleReload}
      hideElevation={isMobile}
      onPickPoint={(poi: AmapPOI | null) => {
        if (poi) {
          planner.addWaypoint(poi)
          toast.success("已添加点位", { description: poi.name })
        }
      }}
    />
  )

  if (isMobile) {
    return (
      <>
        <MobileLayout
          waypoints={planner.waypoints}
          route={planner.route}
          elevation={planner.elevation}
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
          onClear={handleClear}
          onImport={handleImport}
          onExport={handleExport}
          mapNode={mapNode}
        />
        <Toaster position="top-center" />
      </>
    )
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
        onClear={handleClear}
        onImport={handleImport}
        onExport={handleExport}
      />

      {mapNode}

      <Toaster position="top-center" />
    </main>
  )
}
