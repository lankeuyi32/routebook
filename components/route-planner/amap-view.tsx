"use client"

/**
 * 真实高德 JS API 地图视图
 *
 * 文档：
 * - JS API v2：https://lbs.amap.com/api/javascript-api-v2/summary
 * - 加载器：https://lbs.amap.com/api/jsapi-v2/guide/abc/load
 * - Marker / Polyline / TileLayer：
 *     https://lbs.amap.com/api/javascript-api-v2/guide/overlays
 *     https://lbs.amap.com/api/javascript-api-v2/guide/layers
 *
 * 安全：
 * - 浏览器中只能用 NEXT_PUBLIC_AMAP_KEY (JS API Key)，并搭配
 *   NEXT_PUBLIC_AMAP_SECURITY_CODE（高德安全密钥）。
 * - JS Key 必须在高德控制台设置域名白名单。
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { Waypoint, RoutePlanResult, LngLat, ElevationPoint } from "@/types/route"
import { MapTopToolbar, MapZoomControls, type MapLayer } from "./map-toolbar"
import { ElevationProfile } from "./elevation-profile"
import { getAmapJsKey, getAmapSecurityCode, reverseGeocode } from "@/services/amap"
import { Loader2, AlertCircle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  waypoints: Waypoint[]
  route: RoutePlanResult | null
  elevation: ElevationPoint[]
  /** 全览触发：用于地图重置视野 */
  overviewSignal?: number
  /** 地图点选添加点位 */
  onPickPoint?: (poi: Awaited<ReturnType<typeof reverseGeocode>>) => void
}

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string }
    AMap?: unknown
  }
}

interface AMapInstance {
  setFitView: (
    overlays?: unknown[] | null,
    immediately?: boolean,
    avoid?: number[],
    maxZoom?: number,
  ) => void
  zoomIn: () => void
  zoomOut: () => void
  setMapStyle: (style: string) => void
  add: (overlay: unknown | unknown[]) => void
  remove: (overlay: unknown | unknown[]) => void
  destroy: () => void
  on: (event: string, fn: (e: { lnglat: { lng: number; lat: number } }) => void) => void
  off: (event: string, fn: unknown) => void
}

interface AMapNS {
  Map: new (container: HTMLElement, opts: Record<string, unknown>) => AMapInstance
  Marker: new (opts: Record<string, unknown>) => unknown
  Polyline: new (opts: Record<string, unknown>) => unknown
  TileLayer: {
    new (opts?: Record<string, unknown>): unknown
    Satellite: new () => unknown
    RoadNet: new () => unknown
    Traffic: new (opts?: Record<string, unknown>) => unknown
  }
  LngLat: new (lng: number, lat: number) => unknown
  Pixel: new (x: number, y: number) => unknown
  Size: new (w: number, h: number) => unknown
  Bounds: unknown
}

const ROLE_COLOR: Record<Waypoint["role"], string> = {
  start: "#0f172a",
  via: "#475569",
  end: "#2563eb",
}

const ROLE_LABEL: Record<Waypoint["role"], string> = {
  start: "起",
  via: "途",
  end: "终",
}

function buildMarkerContent(role: Waypoint["role"], idx: number, name: string) {
  const color = ROLE_COLOR[role]
  const badge = role === "via" ? String(idx) : ROLE_LABEL[role]
  // 使用纯 HTML 自定义内容（不依赖外部图片）
  return `
    <div style="position:relative;transform:translate(-50%,-100%);">
      <div style="
        background:${color};
        color:#fff;
        width:32px;
        height:32px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 4px 10px rgba(0,0,0,.18);
        display:flex;
        align-items:center;
        justify-content:center;
        border:2px solid #fff;
      ">
        <span style="transform:rotate(45deg);font-size:13px;font-weight:600;font-family:system-ui,-apple-system,'PingFang SC';line-height:1;">${badge}</span>
      </div>
      <div style="
        position:absolute;
        top:-26px;
        left:50%;
        transform:translateX(-50%);
        background:rgba(15,23,42,.92);
        color:#fff;
        font-size:11px;
        font-weight:500;
        padding:2px 6px;
        border-radius:4px;
        white-space:nowrap;
        max-width:160px;
        overflow:hidden;
        text-overflow:ellipsis;
        font-family:system-ui,-apple-system,'PingFang SC';
      ">${escapeHtml(name)}</div>
    </div>
  `
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function AMapView({
  waypoints,
  route,
  elevation,
  overviewSignal,
  onPickPoint,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<AMapInstance | null>(null)
  const amapNsRef = useRef<AMapNS | null>(null)
  const markersRef = useRef<unknown[]>([])
  const polylineRef = useRef<unknown | null>(null)
  const layerCacheRef = useRef<Record<string, unknown>>({})
  const pickModeRef = useRef(false)

  const [layer, setLayer] = useState<MapLayer>("standard")
  const [pickMode, setPickMode] = useState(false)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const jsKey = useMemo(() => getAmapJsKey(), [])
  const securityCode = useMemo(() => getAmapSecurityCode(), [])

  // 同步 pickMode 到 ref
  useEffect(() => {
    pickModeRef.current = pickMode
  }, [pickMode])

  // 初始化地图（仅一次）
  useEffect(() => {
    if (!jsKey) {
      setStatus("error")
      setErrorMsg("未配置 NEXT_PUBLIC_AMAP_KEY，无法加载真实地图")
      return
    }
    if (typeof window !== "undefined" && securityCode) {
      window._AMapSecurityConfig = { securityJsCode: securityCode }
    }

    let cancelled = false
    console.log("[v0] AMap init: 开始加载，key=", jsKey.slice(0, 6) + "...", "host=", window.location.host)
    // 动态 import 避免 @amap/amap-jsapi-loader 在 SSR 时引用 window 报错
    import("@amap/amap-jsapi-loader")
      .then((mod) => {
        const AMapLoader = mod.default ?? mod
        console.log("[v0] AMap loader 加载成功，开始初始化 JS API…")
        return AMapLoader.load({
          key: jsKey,
          version: "2.0",
          plugins: ["AMap.Scale", "AMap.ToolBar"],
        })
      })
      .then((AMap: AMapNS) => {
        if (cancelled || !containerRef.current) return
        const el = containerRef.current
        console.log(
          "[v0] AMap JS API 加载成功，容器尺寸=",
          el.clientWidth,
          "x",
          el.clientHeight,
        )
        if (el.clientWidth === 0 || el.clientHeight === 0) {
          console.warn("[v0] AMap 容器尺寸为 0，地图无法渲染！")
        }
        amapNsRef.current = AMap
        const map = new AMap.Map(el, {
          zoom: 11,
          center: [116.397428, 39.90923],
          viewMode: "2D",
          mapStyle: "amap://styles/normal",
          resizeEnable: true,
        })
        mapRef.current = map

        // 地图点击 -> 反查 POI 并回调
        map.on("click", async (e) => {
          if (!pickModeRef.current) return
          const { lng, lat } = e.lnglat
          const poi = await reverseGeocode(lng, lat)
          if (poi && onPickPoint) onPickPoint(poi)
          setPickMode(false)
        })

        setStatus("ready")
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error("[v0] AMap 加载失败:", err)
        const raw = err instanceof Error ? err.message : String(err)
        // 识别常见错误码并给出友好提示
        let friendly = raw
        if (/USERKEY_PLAT_NOMATCH|InvalidUserKey/i.test(raw)) {
          friendly = "高德 Key 类型不匹配：浏览器需使用「Web端(JS API)」类型的 Key"
        } else if (/INVALID_USER_DOMAIN|domain/i.test(raw)) {
          friendly = `Key 未授权当前域名：请在高德控制台为该 Key 添加白名单 ${window.location.host}`
        } else if (/InvalidUserScode|Scode/i.test(raw)) {
          friendly = "高德安全密钥(securityJsCode)配置错误"
        } else if (/quota|QUOTA|DAILY_QUERY_OVER_LIMIT/i.test(raw)) {
          friendly = "高德 API 配额已用尽"
        }
        setStatus("error")
        setErrorMsg(friendly)
      })

    return () => {
      cancelled = true
      mapRef.current?.destroy()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsKey, securityCode])

  // 同步图层
  useEffect(() => {
    const map = mapRef.current
    const AMap = amapNsRef.current
    if (!map || !AMap) return

    // 清掉所有可叠加的图层
    for (const k of Object.keys(layerCacheRef.current)) {
      map.remove(layerCacheRef.current[k] as unknown[])
    }
    layerCacheRef.current = {}

    if (layer === "standard") {
      map.setMapStyle("amap://styles/normal")
    } else if (layer === "satellite") {
      map.setMapStyle("amap://styles/normal")
      const sat = new AMap.TileLayer.Satellite()
      const road = new AMap.TileLayer.RoadNet()
      map.add([sat, road])
      layerCacheRef.current.sat = sat
      layerCacheRef.current.road = road
    } else if (layer === "terrain") {
      // 地形：使用更柔和的样式
      map.setMapStyle("amap://styles/whitesmoke")
    } else if (layer === "cycling") {
      // 骑行：标准样式 + 实时路况
      map.setMapStyle("amap://styles/normal")
      const traffic = new AMap.TileLayer.Traffic({ autoRefresh: true, interval: 180 })
      map.add(traffic)
      layerCacheRef.current.traffic = traffic
    }
  }, [layer])

  // 同步 markers
  useEffect(() => {
    const map = mapRef.current
    const AMap = amapNsRef.current
    if (!map || !AMap) return

    map.remove(markersRef.current)
    markersRef.current = []

    waypoints.forEach((w, i) => {
      const viaIdx = waypoints.slice(0, i).filter((x) => x.role === "via").length + 1
      const marker = new AMap.Marker({
        position: w.poi.lngLat,
        anchor: "bottom-center",
        offset: new AMap.Pixel(0, 0),
        content: buildMarkerContent(w.role, viaIdx, w.poi.name),
        zIndex: 100 + i,
        bubble: true,
      })
      map.add(marker)
      markersRef.current.push(marker)
    })

    // 自动调整视野
    if (waypoints.length > 0) {
      map.setFitView(markersRef.current as unknown[], false, [80, 80, 200, 80], 16)
    }
  }, [waypoints])

  // 同步 polyline
  useEffect(() => {
    const map = mapRef.current
    const AMap = amapNsRef.current
    if (!map || !AMap) return

    if (polylineRef.current) {
      map.remove(polylineRef.current)
      polylineRef.current = null
    }
    if (!route || route.path.length === 0) return

    const polyline = new AMap.Polyline({
      path: route.path as LngLat[],
      strokeColor: "#2563eb",
      strokeWeight: 6,
      strokeOpacity: 0.9,
      lineJoin: "round",
      lineCap: "round",
      showDir: true,
      zIndex: 50,
    })
    map.add(polyline)
    polylineRef.current = polyline

    // 路线规划完成后整体调整视野
    map.setFitView(
      [polyline, ...markersRef.current] as unknown[],
      false,
      [80, 80, 200, 80],
      16,
    )
  }, [route])

  // 全览触发
  useEffect(() => {
    if (overviewSignal === undefined) return
    const map = mapRef.current
    if (!map) return
    const overlays: unknown[] = [...markersRef.current]
    if (polylineRef.current) overlays.push(polylineRef.current)
    if (overlays.length > 0) {
      map.setFitView(overlays, false, [80, 80, 200, 80], 16)
    }
  }, [overviewSignal])

  function handleZoomIn() {
    mapRef.current?.zoomIn()
  }
  function handleZoomOut() {
    mapRef.current?.zoomOut()
  }
  function handleReset() {
    const overlays: unknown[] = [...markersRef.current]
    if (polylineRef.current) overlays.push(polylineRef.current)
    if (overlays.length > 0) {
      mapRef.current?.setFitView(overlays, false, [80, 80, 200, 80], 16)
    }
  }

  return (
    <div className="relative flex-1 min-w-0 min-h-0 h-full overflow-hidden bg-muted">
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      {/* 顶部状态条 */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-card border border-border rounded-md shadow-sm px-2.5 py-1.5">
        {status === "loading" && (
          <>
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            <span className="text-[12px] font-medium">加载地图中…</span>
          </>
        )}
        {status === "ready" && (
          <>
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span className="text-[12px] font-medium">高德地图</span>
            <span className="text-[11px] text-muted-foreground">已加载</span>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="size-3.5 text-destructive" />
            <span className="text-[12px] font-medium text-destructive">地图加载失败</span>
          </>
        )}
      </div>

      {/* 错误全屏面板 */}
      {status === "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/80 backdrop-blur-sm p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-lg p-5">
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-1">高德地图加载失败</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed break-all">
                  {errorMsg ?? "未知错误"}
                </p>
              </div>
            </div>
            <div className="border-t border-border pt-3 mt-3">
              <div className="text-[12px] font-medium text-foreground mb-1.5">请按以下步骤排查：</div>
              <ol className="text-[12px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                <li>
                  打开{" "}
                  <a
                    href="https://console.amap.com/dev/key/app"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    高德控制台
                  </a>
                  ，找到对应的 Key
                </li>
                <li>确认该 Key 类型为「Web端(JS API)」</li>
                <li>
                  在「域名白名单」中添加：
                  <code className="ml-1 px-1 py-0.5 bg-muted rounded text-foreground font-mono text-[11px]">
                    {typeof window !== "undefined" ? window.location.host : "*.vusercontent.net"}
                  </code>
                </li>
                <li>确认「安全密钥(securityJsCode)」配置正确</li>
                <li>保存后等 1-2 分钟生效，刷新页面</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* 地图点选按钮 */}
      {status === "ready" && onPickPoint && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <Button
            size="sm"
            variant={pickMode ? "default" : "outline"}
            className="h-8 gap-1.5 shadow-sm"
            onClick={() => setPickMode((v) => !v)}
          >
            <Plus className="size-3.5" />
            {pickMode ? "请在地图上点选位置" : "在地图上添加点位"}
          </Button>
        </div>
      )}

      {/* 顶部右侧图层切换 */}
      <MapTopToolbar layer={layer} onLayerChange={setLayer} />

      {/* 右侧缩放控件 */}
      <MapZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onLocate={handleReset} />

      {/* 海拔剖面 */}
      {route && elevation.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <ElevationProfile data={elevation} />
          </div>
        </div>
      )}
    </div>
  )
}
