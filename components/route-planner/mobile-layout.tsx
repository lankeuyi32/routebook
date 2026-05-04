"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Bike, Search, X, TrendingUp, Maximize2, Minimize2 } from "lucide-react"
import { WaypointList } from "./waypoint-list"
import { RouteActions } from "./route-actions"
import { RouteStats } from "./route-stats"
import { BottomToolbar } from "./bottom-toolbar"
import { SiteFooter } from "./site-footer"
import { ElevationProfile } from "./elevation-profile"
import { MobileSearchPanel } from "./mobile-search-panel"
import { cn } from "@/lib/utils"
import type {
  AmapPOI,
  ElevationPoint,
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
  elevation: ElevationPoint[]
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
  // 搜索面板（仅由 FAB 二次点击 / 内部 X 关闭，不监听点击外部）
  const [searchOpen, setSearchOpen] = useState(false)
  // 海拔剖面（默认关闭，释放更多地点管理空间，由用户主动展开）
  const [elevationOpen, setElevationOpen] = useState(false)
  // 地图全屏（在浏览器视口内填满，不调用 Fullscreen API，避免与 amap 控件冲突）
  const [mapFullscreen, setMapFullscreen] = useState(false)

  // 全屏状态变化时触发 window.resize，让高德地图实例感知容器尺寸变化重新铺满
  useEffect(() => {
    if (typeof window === "undefined") return
    const t = setTimeout(() => {
      window.dispatchEvent(new Event("resize"))
    }, 220)
    return () => clearTimeout(t)
  }, [mapFullscreen])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const top = e.currentTarget.scrollTop
    if (top > HIDE_HEADER_AT && !scrolled) setScrolled(true)
    else if (top <= HIDE_HEADER_AT && scrolled) setScrolled(false)
  }

  const hasElevation = Boolean(props.route && props.elevation.length > 0)

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

      {/* 地图区：默认 38vh；切换全屏后变为浏览器视口铺满（fixed inset-0 z-50） */}
      <div
        className={cn(
          "flex relative border-b border-border bg-muted overflow-hidden",
          mapFullscreen
            ? "fixed inset-0 z-50 h-screen w-screen max-h-none"
            : "shrink-0 h-[38vh] min-h-[240px] max-h-[420px]",
        )}
      >
        {props.mapNode}

        {/* 全屏切换：左上角（原状态条位置已让出），仅手机端可见 */}
        <button
          type="button"
          onClick={() => setMapFullscreen((v) => !v)}
          aria-label={mapFullscreen ? "退出全屏" : "全屏展示地图"}
          aria-pressed={mapFullscreen}
          className={cn(
            "absolute top-3 left-3 z-30 size-10 rounded-full shadow-lg",
            "flex items-center justify-center transition-colors",
            "bg-card border border-border text-foreground hover:bg-accent",
          )}
        >
          {mapFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>

        {/* 搜索 FAB：右上角，与底层 map-toolbar（top-16）错开避免重叠 */}
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label={searchOpen ? "收起搜索" : "搜索地点"}
          aria-expanded={searchOpen}
          className={cn(
            "absolute top-3 right-3 z-30 size-10 rounded-full shadow-lg",
            "flex items-center justify-center transition-colors",
            searchOpen
              ? "bg-card border border-border text-foreground"
              : "bg-blue-600 hover:bg-blue-700 text-white",
          )}
        >
          {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
        </button>

        {/* 海拔剖面 FAB：左下角，路线就绪时显示 */}
        {hasElevation && (
          <button
            type="button"
            onClick={() => setElevationOpen((v) => !v)}
            aria-label={elevationOpen ? "收起海拔剖面" : "展开海拔剖面"}
            aria-pressed={elevationOpen}
            className={cn(
              "absolute bottom-3 left-3 z-30 h-9 px-3 rounded-md shadow-md",
              "flex items-center gap-1.5 text-[12px] font-medium transition-colors",
              elevationOpen
                ? "bg-foreground text-background"
                : "bg-card border border-border text-foreground hover:bg-accent",
            )}
          >
            <TrendingUp className="size-3.5" />
            海拔
          </button>
        )}

        {/* 滑出式搜索面板：从右向左展开，宽度上限 360px / 85vw，仅由 FAB 二次点击或内部关闭按钮收回 */}
        <div
          aria-hidden={!searchOpen}
          className={cn(
            "absolute top-0 right-0 bottom-0 z-20 w-[min(85vw,360px)]",
            "border-l border-border bg-card shadow-2xl",
            "transition-transform duration-200 ease-out",
            searchOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
          )}
        >
          {/* 仅在打开时挂载内容，关闭时清空状态以避免内存与无效搜索 */}
          {searchOpen && (
            <MobileSearchPanel
              onSelect={props.onAddPoi}
              addedIds={addedIds}
              onClose={() => setSearchOpen(false)}
            />
          )}
        </div>
      </div>

      {/* 海拔剖面：插入到地图与下方工作区之间，仅在 FAB 切换为开启时渲染 */}
      {hasElevation && elevationOpen && (
        <div className="shrink-0">
          <ElevationProfile data={props.elevation} />
        </div>
      )}

      {/* 工作区：地点管理 + 路线操作 + 统计；释放出更大的可滚动空间 */}
      <div
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-card"
      >
        {/* 点位管理（默认仅展示约 5 个点位的高度，超出在列表内部滚动） */}
        <WaypointList
          waypoints={props.waypoints}
          onRemove={props.onRemoveWaypoint}
          onRemoveMany={props.onRemoveWaypoints}
          onReorder={props.onReorderWaypoints}
          listMaxHeightClass="max-h-[320px]"
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
        <div className="h-4" aria-hidden />
      </div>

      {/* 底部工具栏（粘底，自带 border-t / bg-card） */}
      <div className="shrink-0">
        <BottomToolbar
          hasRoute={!!props.route}
          onImport={props.onImport}
          onExport={props.onExport}
        />
      </div>

      {/* 全站页脚（版权 / 关于 / GitHub） */}
      <SiteFooter />
    </div>
  )
}
