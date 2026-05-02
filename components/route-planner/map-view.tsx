"use client"

/**
 * 地图视图
 *
 * ⚠️ 当前实现是用于 v0 预览的"地图骨架"：基于 SVG 渲染浅色地图风格底图、
 *    polyline 路线和带编号的 marker。背景的道路 / POI / 区域标签仅用于呈现
 *    最终视觉效果，不代表真实地理数据。
 *
 * 接入真实高德 JS API 时，请在本组件内部用 AMap.Map 实例替换 SVG 渲染：
 *   - new AMap.Map(container, { ... })  https://lbs.amap.com/api/javascript-api-v2/documentation
 *   - AMap.Marker / AMap.Polyline       https://lbs.amap.com/api/javascript-api-v2/guide/overlays
 *   - map.setFitView()                   https://lbs.amap.com/api/javascript-api-v2/documentation#map
 *   - 图层切换：satelliteLayer/trafficLayer/roadNetLayer
 *   - 路径绘制使用规划接口返回的 path 字段
 */

import { useMemo, useState } from "react"
import type { Waypoint, RoutePlanResult, LngLat } from "@/types/route"
import { MapTopToolbar, MapZoomControls, type MapLayer } from "./map-toolbar"
import { ElevationProfile } from "./elevation-profile"
import type { ElevationPoint } from "@/types/route"
import { formatDistance } from "@/lib/route-utils"
import { cn } from "@/lib/utils"

interface Props {
  waypoints: Waypoint[]
  route: RoutePlanResult | null
  elevation: ElevationPoint[]
  /** 全览触发：用于地图重置视野（当前实现重新计算 bounds） */
  overviewSignal?: number
}

const VIEW_W = 1600
const VIEW_H = 1000

/** 把 LngLat 数组按其包围盒映射到 SVG 视口 */
function buildProjector(points: LngLat[]) {
  if (points.length === 0) {
    return (p: LngLat) => [VIEW_W / 2, VIEW_H / 2] as [number, number]
  }
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  // padding
  const padX = (maxLng - minLng) * 0.18 || 0.005
  const padY = (maxLat - minLat) * 0.22 || 0.005
  minLng -= padX
  maxLng += padX
  minLat -= padY
  maxLat += padY

  const lngRange = maxLng - minLng || 1
  const latRange = maxLat - minLat || 1

  return ([lng, lat]: LngLat): [number, number] => {
    const x = ((lng - minLng) / lngRange) * VIEW_W
    const y = VIEW_H - ((lat - minLat) / latRange) * VIEW_H
    return [x, y]
  }
}

const ROLE_COLOR: Record<Waypoint["role"], string> = {
  start: "#0f172a",
  via: "#475569",
  end: "#2563eb",
}

export function MapView({ waypoints, route, elevation }: Props) {
  const [layer, setLayer] = useState<MapLayer>("standard")
  const [zoom, setZoom] = useState(1)

  const allPoints = useMemo<LngLat[]>(() => {
    const pts: LngLat[] = waypoints.map((w) => w.poi.lngLat)
    if (route) pts.push(...route.path)
    return pts
  }, [waypoints, route])

  const project = useMemo(() => buildProjector(allPoints), [allPoints])

  const projectedPath = useMemo(() => {
    if (!route) return ""
    return route.path.map((p, i) => `${i === 0 ? "M" : "L"} ${project(p).join(" ")}`).join(" ")
  }, [route, project])

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden bg-[#f3efe8]">
      {/* 顶部加载状态 */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-card border border-border rounded-md shadow-sm px-2.5 py-1.5">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        <span className="text-[12px] font-medium">地图预览</span>
        <span className="text-[11px] text-muted-foreground">已加载</span>
      </div>

      {/* 顶部右侧：路线概览（仅在有路线时显示） */}
      {route && (
        <div className="absolute top-14 right-3 z-10 bg-card border border-border rounded-md shadow-sm px-3 py-2 flex items-center gap-3 text-[11px]">
          <Stat label="总里程" value={formatDistance(route.distance)} />
          <span className="w-px h-4 bg-border" />
          <Stat label="爬升" value={`${route.ascent ?? 0}m`} />
          <span className="w-px h-4 bg-border" />
          <Stat label="最大坡度" value={`${route.maxGrade ?? 0}%`} />
        </div>
      )}

      <MapTopToolbar
        layer={layer}
        onLayerChange={setLayer}
        onZoomIn={() => setZoom((z) => Math.min(z + 0.15, 2))}
        onZoomOut={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
      />

      <MapZoomControls
        onZoomIn={() => setZoom((z) => Math.min(z + 0.15, 2))}
        onZoomOut={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
      />

      {/* 地图主体 */}
      <div className="relative flex-1 overflow-hidden">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        >
          {/* 背景 - 模拟高德标准底图 */}
          <MapBackground layer={layer} />

          {/* 路线 polyline */}
          {projectedPath && (
            <g>
              {/* 外白边 */}
              <path
                d={projectedPath}
                fill="none"
                stroke="#ffffff"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* 主线 */}
              <path
                d={projectedPath}
                fill="none"
                stroke="#1d8eff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* 点位 marker */}
          {waypoints.map((w, i) => {
            const [x, y] = project(w.poi.lngLat)
            const color = ROLE_COLOR[w.role]
            return (
              <g key={w.uid} transform={`translate(${x} ${y})`}>
                {/* 阴影 */}
                <ellipse cx="0" cy="6" rx="14" ry="3" fill="#000" opacity="0.18" />
                {/* 水滴形 */}
                <path
                  d="M 0 -34 C -12 -34 -18 -25 -18 -16 C -18 -6 -8 4 0 14 C 8 4 18 -6 18 -16 C 18 -25 12 -34 0 -34 Z"
                  fill={color}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <circle cx="0" cy="-18" r="9" fill="#fff" />
                <text
                  x="0"
                  y="-14"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill={color}
                >
                  {i + 1}
                </text>
              </g>
            )
          })}
        </svg>

        {/* 空状态 */}
        {waypoints.length === 0 && !route && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-card/95 backdrop-blur border border-border rounded-lg px-6 py-5 text-center shadow-sm max-w-sm">
              <div className="text-[14px] font-medium text-foreground">添加点位以开始规划</div>
              <div className="text-[12px] text-muted-foreground mt-1.5">
                通过左侧搜索面板添加起点和终点，路线将沿真实道路自动生成
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 海拔剖面图 */}
      {elevation.length > 0 && <ElevationProfile data={elevation} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-semibold tabular-nums">{value}</span>
    </div>
  )
}

/**
 * 仅用于预览的视觉底图（道路网 / 公园 / 水体 / POI 标签）
 * 替换为 AMap 时整段删除即可。
 */
function MapBackground({ layer }: { layer: MapLayer }) {
  if (layer === "satellite") {
    return (
      <g>
        <rect width={VIEW_W} height={VIEW_H} fill="#2a2f36" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#sat-noise)" opacity="0.3" />
        <defs>
          <pattern id="sat-noise" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#3a4048" />
            <rect width="3" height="3" fill="#2a2f36" />
          </pattern>
        </defs>
      </g>
    )
  }

  if (layer === "terrain") {
    return (
      <g>
        <rect width={VIEW_W} height={VIEW_H} fill="#ebe5d6" />
        {/* 等高线 */}
        {Array.from({ length: 18 }).map((_, i) => (
          <path
            key={i}
            d={`M ${-50 + i * 30} ${300 + Math.sin(i) * 80} Q ${300 + i * 60} ${
              200 + Math.cos(i) * 100
            } ${800 + i * 30} ${400 + Math.sin(i * 1.3) * 90} T ${VIEW_W + 50} ${
              500 + Math.cos(i * 0.7) * 60
            }`}
            fill="none"
            stroke="#c9bf9f"
            strokeWidth="1"
            opacity="0.6"
          />
        ))}
      </g>
    )
  }

  // standard / cycling 共用浅色高德风
  return (
    <g>
      <rect width={VIEW_W} height={VIEW_H} fill="#f3efe8" />

      {/* 公园 / 绿地 */}
      <path
        d="M 80 120 Q 240 80 360 160 Q 420 280 320 360 Q 180 400 100 320 Z"
        fill="#dfe9d4"
      />
      <path
        d="M 1100 540 Q 1280 500 1420 580 Q 1500 700 1420 820 Q 1240 880 1120 800 Q 1040 680 1100 540 Z"
        fill="#dfe9d4"
      />
      <path
        d="M 600 760 Q 720 720 820 800 Q 860 880 760 920 Q 640 940 580 880 Z"
        fill="#dfe9d4"
      />

      {/* 水体 */}
      <path
        d="M 880 80 Q 1050 60 1200 140 Q 1300 220 1280 320 Q 1200 380 1080 360 Q 940 300 880 200 Z"
        fill="#cfe1ef"
      />
      <path
        d="M 200 700 Q 360 680 460 740 Q 480 820 380 860 Q 260 880 180 820 Z"
        fill="#cfe1ef"
      />

      {/* 主路边线 */}
      <g stroke="#e6dfcf" strokeWidth="16" fill="none" strokeLinecap="round" opacity="0.9">
        <line x1="0" y1="260" x2={VIEW_W} y2="260" />
        <line x1="0" y1="520" x2={VIEW_W} y2="520" />
        <line x1="0" y1="800" x2={VIEW_W} y2="800" />
        <line x1="360" y1="0" x2="360" y2={VIEW_H} />
        <line x1="800" y1="0" x2="800" y2={VIEW_H} />
        <line x1="1200" y1="0" x2="1200" y2={VIEW_H} />
      </g>
      {/* 主路面 */}
      <g stroke="#ffffff" strokeWidth="8" fill="none" strokeLinecap="round">
        <line x1="0" y1="260" x2={VIEW_W} y2="260" />
        <line x1="0" y1="520" x2={VIEW_W} y2="520" />
        <line x1="0" y1="800" x2={VIEW_W} y2="800" />
        <line x1="360" y1="0" x2="360" y2={VIEW_H} />
        <line x1="800" y1="0" x2="800" y2={VIEW_H} />
        <line x1="1200" y1="0" x2="1200" y2={VIEW_H} />
      </g>

      {/* 次要道路 */}
      <g stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.95">
        <line x1="0" y1="120" x2={VIEW_W} y2="140" />
        <line x1="0" y1="380" x2={VIEW_W} y2="400" />
        <line x1="0" y1="660" x2={VIEW_W} y2="640" />
        <line x1="0" y1="900" x2={VIEW_W} y2="880" />
        <line x1="160" y1="0" x2="180" y2={VIEW_H} />
        <line x1="560" y1="0" x2="580" y2={VIEW_H} />
        <line x1="960" y1="0" x2="980" y2={VIEW_H} />
        <line x1="1380" y1="0" x2="1400" y2={VIEW_H} />
      </g>

      {/* 骑行图层叠加：高亮蓝色虚线 */}
      {layer === "cycling" && (
        <g stroke="#1d8eff" strokeWidth="2" strokeDasharray="6 6" fill="none" opacity="0.7">
          <line x1="0" y1="380" x2={VIEW_W} y2="400" />
          <line x1="560" y1="0" x2="580" y2={VIEW_H} />
          <line x1="960" y1="0" x2="980" y2={VIEW_H} />
        </g>
      )}

      {/* POI / 区域标签（中文） */}
      <g
        className={cn(
          "[&_text]:fill-foreground [&_text]:font-medium",
          layer === "satellite" && "[&_text]:fill-white",
        )}
      >
        <text x="220" y="240" fontSize="16" opacity="0.7">
          中央公园
        </text>
        <text x="1180" y="700" fontSize="16" opacity="0.7">
          滨江绿地
        </text>
        <text x="660" y="860" fontSize="14" opacity="0.7">
          市民广场
        </text>
        <text x="1000" y="200" fontSize="16" opacity="0.7">
          翠湖
        </text>
        <text x="280" y="800" fontSize="14" opacity="0.7">
          月牙湖
        </text>

        <text x="500" y="160" fontSize="12" fill="#64748b" opacity="0.85">
          长安大道
        </text>
        <text x="500" y="420" fontSize="12" fill="#64748b" opacity="0.85">
          滨河路
        </text>
        <text x="500" y="700" fontSize="12" fill="#64748b" opacity="0.85">
          骑行专用道
        </text>
        <text
          x="380"
          y="500"
          fontSize="12"
          fill="#64748b"
          opacity="0.85"
          transform="rotate(-90 380 500)"
        >
          人民路
        </text>
        <text
          x="800"
          y="500"
          fontSize="12"
          fill="#64748b"
          opacity="0.85"
          transform="rotate(-90 800 500)"
        >
          解放路
        </text>
      </g>

      {/* 网格底纹 */}
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#e8e2d4" strokeWidth="0.5" />
      </pattern>
      <rect width={VIEW_W} height={VIEW_H} fill="url(#grid)" opacity="0.4" />
    </g>
  )
}
