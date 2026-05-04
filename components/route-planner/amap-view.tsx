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
import { Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { launchAmapNav } from "@/lib/launch-nav"
import { NavLaunchDialog } from "./nav-launch-dialog"

interface Props {
  waypoints: Waypoint[]
  route: RoutePlanResult | null
  elevation: ElevationPoint[]
  /** 全览触发：用于地图重置视野 */
  overviewSignal?: number
  /** 地图点选添加点位 */
  onPickPoint?: (poi: Awaited<ReturnType<typeof reverseGeocode>>) => void
  /** 「重载」按钮回调，由父组件接路线重新规划逻辑；未传时回退到地图全览 */
  onReload?: () => void
  /** 隐藏地图内置的海拔剖面浮层（移动端将海拔放到搜索栏与地图之间渲染，因此传 true） */
  hideElevation?: boolean
}

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string }
    AMap?: unknown
  }
}

/** 地图 click 事件 */
interface AMapClickEvent {
  lnglat: { lng: number; lat: number }
  pixel: { x: number; y: number }
  type: string
  target?: unknown
}

/** 地图 hotspotclick 事件（点击底图自带 POI 标签时触发） */
interface AMapHotspotEvent {
  lnglat: { lng: number; lat: number; getLng?: () => number; getLat?: () => number }
  /** 高德 POI ID */
  id: string
  /** POI 名称 */
  name: string
  type?: string
}

interface AMapInfoWindowInstance {
  open: (map: AMapInstance, position: [number, number]) => void
  close: () => void
  setContent: (content: string | HTMLElement) => void
  setPosition: (position: [number, number]) => void
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
  setCenter: (center: [number, number], immediately?: boolean) => void
  setZoom: (zoom: number, immediately?: boolean) => void
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean) => void
  add: (overlay: unknown | unknown[]) => void
  remove: (overlay: unknown | unknown[]) => void
  destroy: () => void
  on(event: "click", fn: (e: AMapClickEvent) => void): void
  on(event: "hotspotclick", fn: (e: AMapHotspotEvent) => void): void
  on(event: string, fn: (e: unknown) => void): void
  off: (event: string, fn: unknown) => void
}

interface AMapNS {
  Map: new (container: HTMLElement, opts: Record<string, unknown>) => AMapInstance
  Marker: new (opts: Record<string, unknown>) => unknown
  Polyline: new (opts: Record<string, unknown>) => unknown
  InfoWindow: new (opts: Record<string, unknown>) => AMapInfoWindowInstance
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
  /** WGS84 -> GCJ02 坐标转换（plugin AMap.convertFrom） */
  convertFrom?: (
    lnglat: [number, number] | [number, number][],
    type: "gps" | "baidu" | "mapbar",
    cb: (status: string, result: { info: string; locations: { lng: number; lat: number }[] }) => void,
  ) => void
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

/** 构建底图 POI 信息弹窗（点击后可一键加入路线） */
function createPoiPopup(opts: {
  name: string
  address: string
  cityname?: string
  adname?: string
  lng: number
  lat: number
  /** 是否正在反查地址，true 时按钮禁用 */
  loading?: boolean
  onAdd: () => void
  /** 关闭弹窗回调（来自调用方持有的 InfoWindow 实例） */
  onClose?: () => void
}): HTMLElement {
  const { name, address, cityname, adname, lng, lat, loading = false, onAdd, onClose } = opts
  const wrap = document.createElement("div")
  wrap.style.cssText = `
    position:relative;
    background:#fff;
    border-radius:8px;
    box-shadow:0 8px 24px rgba(15,23,42,.16);
    border:1px solid rgba(15,23,42,.06);
    padding:12px 12px 10px;
    min-width:220px;
    max-width:280px;
    font-family:system-ui,-apple-system,'PingFang SC';
  `
  const region = [cityname, adname].filter(Boolean).join(" · ")
  const btnLabel = loading ? "正在解析地址…" : "+ 添加到路线"
  const btnBg = loading ? "#94a3b8" : "#2563eb"
  const btnCursor = loading ? "wait" : "pointer"
  wrap.innerHTML = `
    <button
      data-close-btn
      aria-label="关闭"
      style="
        position:absolute;
        top:6px;
        right:6px;
        width:22px;
        height:22px;
        padding:0;
        background:transparent;
        border:none;
        border-radius:4px;
        color:#94a3b8;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        font-family:inherit;
        transition:background 0.15s, color 0.15s;
      "
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div style="font-size:13px;font-weight:600;color:#0f172a;line-height:1.3;margin-bottom:4px;padding-right:22px;">
      ${escapeHtml(name)}
    </div>
    ${
      region
        ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px;">${escapeHtml(region)}</div>`
        : ""
    }
    <div style="font-size:11px;color:${loading ? "#94a3b8" : "#64748b"};line-height:1.45;margin-bottom:6px;word-break:break-all;">
      ${escapeHtml(address)}
    </div>
    <div style="font-size:10px;color:#94a3b8;font-family:ui-monospace,monospace;margin-bottom:8px;">
      ${lng.toFixed(5)}, ${lat.toFixed(5)}
    </div>
    <button
      data-add-btn
      ${loading ? "disabled" : ""}
      style="
        width:100%;
        background:${btnBg};
        color:#fff;
        border:none;
        border-radius:6px;
        padding:6px 10px;
        font-size:12px;
        font-weight:500;
        cursor:${btnCursor};
        font-family:inherit;
        opacity:${loading ? "0.7" : "1"};
        transition:background 0.15s;
      "
    >${btnLabel}</button>
  `
  const btn = wrap.querySelector<HTMLButtonElement>("[data-add-btn]")
  if (btn && !loading) {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation()
      onAdd()
    })
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#1d4ed8"
    })
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "#2563eb"
    })
  }
  const closeBtn = wrap.querySelector<HTMLButtonElement>("[data-close-btn]")
  if (closeBtn) {
    closeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation()
      onClose?.()
    })
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.background = "#f1f5f9"
      closeBtn.style.color = "#0f172a"
    })
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.background = "transparent"
      closeBtn.style.color = "#94a3b8"
    })
  }
  return wrap
}

export function AMapView({
  waypoints,
  route,
  elevation,
  overviewSignal,
  onPickPoint,
  onReload,
  hideElevation = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<AMapInstance | null>(null)
  const amapNsRef = useRef<AMapNS | null>(null)
  const markersRef = useRef<unknown[]>([])
  const polylineRef = useRef<unknown | null>(null)
  const layerCacheRef = useRef<Record<string, unknown>>({})
  const infoWindowRef = useRef<AMapInfoWindowInstance | null>(null)
  // hotspotclick 触发时间戳，用于在 250ms 内去重 click 事件
  const lastHotspotTsRef = useRef(0)
  // 记录上一次 waypoints 数量，仅在数量变化时 fitView，避免改名/拖���时视野被重置
  const prevWaypointCountRef = useRef(0)
  // 用户当前位置 marker（GPS 定位用），与路线点位 marker 分开管理
  const userLocationMarkerRef = useRef<unknown | null>(null)
  const [locating, setLocating] = useState(false)
  // 拉起导航前的「起 / 终点选择」对话框开关
  const [navDialogOpen, setNavDialogOpen] = useState(false)
  // onPickPoint 用 ref 避免重新初始化地图
  const onPickPointRef = useRef(onPickPoint)
  useEffect(() => {
    onPickPointRef.current = onPickPoint
  }, [onPickPoint])

  const [layer, setLayer] = useState<MapLayer>("standard")
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const jsKey = useMemo(() => getAmapJsKey(), [])
  const securityCode = useMemo(() => getAmapSecurityCode(), [])

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
          plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.convertFrom"],
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
          // 开启底图 POI（默认开启），并允许点击热点
          showLabel: true,
          isHotspot: true,
        })
        mapRef.current = map

        // 1) 地图任意位置点击 -> 弹出信息卡，用户确认后再加入路线（与点击底图 POI 行为一致）
        //    注意：点击底图 POI 标签时高德会同时触发 click 和 hotspotclick，
        //    用 lastHotspotTsRef 在 250ms 内去重，避免开两个弹窗
        map.on("click", async (e) => {
          // 250ms 内刚刚处理过 hotspotclick，跳过避免重复弹窗
          if (Date.now() - lastHotspotTsRef.current < 250) return

          const { lng, lat } = e.lnglat

          const fallbackAddress = `${lng.toFixed(5)}, ${lat.toFixed(5)}`
          let name = "地图点选位置"
          let address = fallbackAddress
          let cityname: string | undefined
          let adname: string | undefined

          const handleAdd = () => {
            onPickPointRef.current?.({
              id: `MAP_${lng},${lat}`,
              name,
              address,
              location: `${lng},${lat}`,
              lngLat: [lng, lat] as LngLat,
              cityname,
              adname,
            })
            infoWindowRef.current?.close()
          }

          const handleClose = () => infoWindowRef.current?.close()

          // 第一帧 loading
          infoWindowRef.current?.setContent(
            createPoiPopup({
              name: "正在解析位置…",
              address: "正在解析地址…",
              lng,
              lat,
              loading: true,
              onAdd: handleAdd,
              onClose: handleClose,
            }),
          )
          infoWindowRef.current?.open(map, [lng, lat])

          const detail = await reverseGeocode(lng, lat)
          if (detail) {
            name = detail.name || name
            address = detail.address || fallbackAddress
            cityname = detail.cityname
            adname = detail.adname
          }
          infoWindowRef.current?.setContent(
            createPoiPopup({
              name,
              address,
              cityname,
              adname,
              lng,
              lat,
              loading: false,
              onAdd: handleAdd,
              onClose: handleClose,
            }),
          )
        })

        // 2) 点击底图原生 POI 标签（公园/学校/建筑等）-> 弹出 InfoWindow
        const infoWindow = new AMap.InfoWindow({
          isCustom: true,
          autoMove: true,
          offset: [0, -8],
          content: createPoiPopup({
            name: "",
            address: "",
            lng: 0,
            lat: 0,
            onAdd: () => {},
          }),
        })
        infoWindowRef.current = infoWindow

        map.on("hotspotclick", async (e) => {
          lastHotspotTsRef.current = Date.now()
          const lng = typeof e.lnglat.getLng === "function" ? e.lnglat.getLng() : e.lnglat.lng
          const lat = typeof e.lnglat.getLat === "function" ? e.lnglat.getLat() : e.lnglat.lat
          console.log("[v0] hotspotclick:", e.name, e.id, lng, lat)

          // 用闭包变量持有最新地址信息，handleAdd 始终读最新值
          const fallbackAddress = `${lng.toFixed(5)}, ${lat.toFixed(5)}`
          let address = fallbackAddress
          let cityname: string | undefined
          let adname: string | undefined

          const handleAdd = () => {
            onPickPointRef.current?.({
              id: e.id,
              name: e.name,
              address,
              location: `${lng},${lat}`,
              lngLat: [lng, lat] as LngLat,
              cityname,
              adname,
            })
            infoWindow.close()
          }

          const handleClose = () => infoWindow.close()

          // 第一帧：loading 状态，按钮禁用，避免用户在反查完成前点击
          infoWindow.setContent(
            createPoiPopup({
              name: e.name,
              address: "正在解析地址…",
              lng,
              lat,
              loading: true,
              onAdd: handleAdd,
              onClose: handleClose,
            }),
          )
          infoWindow.open(map, [lng, lat])

          // 异步反查地址
          const detail = await reverseGeocode(lng, lat)
          if (detail) {
            address = detail.address || fallbackAddress
            cityname = detail.cityname
            adname = detail.adname
          }
          // 反查完成（无论成功失败）：刷新弹窗并启用按钮
          infoWindow.setContent(
            createPoiPopup({
              name: e.name,
              address,
              cityname,
              adname,
              lng,
              lat,
              loading: false,
              onAdd: handleAdd,
              onClose: handleClose,
            }),
          )
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

  // 同步图层 —— 每个模式选用视觉差异明显的高德官方 mapStyle，避免肉眼混淆
  useEffect(() => {
    const map = mapRef.current
    const AMap = amapNsRef.current
    if (!map || !AMap) return

    // 清掉所有可叠加的图层
    for (const k of Object.keys(layerCacheRef.current)) {
      map.remove(layerCacheRef.current[k] as unknown[])
    }
    layerCacheRef.current = {}

    console.log("[v0] map layer =>", layer)

    if (layer === "standard") {
      // 标准：默认配色
      map.setMapStyle("amap://styles/normal")
    } else if (layer === "satellite") {
      // 卫星：底图切回 normal（避免样式干扰瓦片），叠加 Satellite + RoadNet
      map.setMapStyle("amap://styles/normal")
      const sat = new AMap.TileLayer.Satellite()
      const road = new AMap.TileLayer.RoadNet()
      map.add([sat, road])
      layerCacheRef.current.sat = sat
      layerCacheRef.current.road = road
    } else if (layer === "terrain") {
      // 地形：低饱和度灰白，突出地势线条
      map.setMapStyle("amap://styles/whitesmoke")
    } else if (layer === "cycling") {
      // 骑行：清新蓝绿底图（fresh）+ 实时路况图层，护眼并能看到拥堵路段
      map.setMapStyle("amap://styles/fresh")
      const traffic = new AMap.TileLayer.Traffic({
        autoRefresh: true,
        interval: 180,
        zIndex: 10,
      })
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
        // bubble: false（默认值）— 点击 marker 不会冒泡到 map.click，避免对已添加点位再次弹"添加到路线"卡
        bubble: false,
      })
      map.add(marker)
      markersRef.current.push(marker)
    })

    // 自动调整视野：仅在「点位数量变化」时调整，避免用户调整完视野后因为名称/排序改变又被强制全览
    if (waypoints.length > 0 && waypoints.length !== prevWaypointCountRef.current) {
      map.setFitView(markersRef.current as unknown[], false, [80, 80, 200, 80], 16)
    }
    prevWaypointCountRef.current = waypoints.length
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

  /**
   * 「拉起导航」��钮入口：先弹出对话框让用户选择起 / 终点，再走真正的唤起逻辑
   */
  function handleLaunchNav() {
    if (waypoints.length < 2) {
      toast.error("至少需要两个点位才能拉起导航")
      return
    }
    setNavDialogOpen(true)
  }

  /**
   * 用户在对话框中确认导航方式 / 起 / 终点后调用 —— 真正执行高德导航唤起
   * - 骑行（ride）：桌面/微信新标签 Web；移动端先试 App scheme，1.6s 未跳走回落 Web；不支持途经点
   * - 驾车（car） ：统一走 Web URI 携带 via 多途经点（最多 16），callnative=1 由高德页面在移动端自动唤起 App
   */
  function launchWithIndices(args: {
    mode: "ride" | "car"
    fromIdx: number
    toIdx: number
  }) {
    const { mode, fromIdx, toIdx } = args
    const start = waypoints[fromIdx]
    const end = waypoints[toIdx]
    if (!start || !end || fromIdx === toIdx) {
      toast.error("起点与终点必须不同")
      return
    }

    const [fromLng, fromLat] = start.poi.lngLat
    const [toLng, toLat] = end.poi.lngLat

    // 收集起 → 终之间的途经点（按用户所选方向排列），仅驾车模式会用到
    const via: { lng: number; lat: number; name: string }[] = []
    if (mode === "car") {
      if (fromIdx < toIdx) {
        for (let i = fromIdx + 1; i < toIdx; i++) {
          const wp = waypoints[i]
          via.push({ lng: wp.poi.lngLat[0], lat: wp.poi.lngLat[1], name: wp.poi.name || `途经${i + 1}` })
        }
      } else {
        for (let i = fromIdx - 1; i > toIdx; i--) {
          const wp = waypoints[i]
          via.push({ lng: wp.poi.lngLat[0], lat: wp.poi.lngLat[1], name: wp.poi.name || `途经${i + 1}` })
        }
      }
    }

    const result = launchAmapNav(
      { lng: fromLng, lat: fromLat, name: start.poi.name || "起点" },
      { lng: toLng, lat: toLat, name: end.poi.name || "终点" },
      { mode, via },
    )

    // 平台、模式、首条尝试 URL 写日志，便于排查
    console.log("[v0] launch nav:", result.platform, result.mode, result.attempts[0], {
      fromIdx,
      toIdx,
      viaCount: result.viaCount,
    })

    // 反馈
    const navName = mode === "car" ? "驾车导航" : "骑行导航"

    if (mode === "car") {
      // 驾车走 Web URI 统一处理
      const desc =
        result.viaCount > 0
          ? `将依次途经 ${result.viaCount} 个点位${
              result.platform === "ios" || result.platform === "android"
                ? "；高德页面会自动尝试唤起 App"
                : ""
            }`
          : result.platform === "ios" || result.platform === "android"
            ? "高德页面会自动尝试唤起 App"
            : undefined
      toast.success(`已打开高德${navName}`, { description: desc, duration: 5000 })
      return
    }

    // 骑行
    if (result.platform === "ios" || result.platform === "android") {
      const lo = Math.min(fromIdx, toIdx)
      const hi = Math.max(fromIdx, toIdx)
      const hasMiddle = hi - lo > 1
      const desc = hasMiddle
        ? `仅使用所选起点与终点（高德骑行不支持途经点）；若未自动唤起 App，会在 1.6 秒后跳转网页版`
        : "若未自动唤起 App，会在 1.6 秒后跳转网页版"
      toast.success(`正在唤起高德${navName}`, { description: desc, duration: 5000 })
    } else if (result.platform === "wechat") {
      toast.message(`微信内已打开网页${navName}`, {
        description: "如需 App 内导航，请右上角选择「在浏览器打开」",
        duration: 6000,
      })
    } else {
      const lo = Math.min(fromIdx, toIdx)
      const hi = Math.max(fromIdx, toIdx)
      const hasMiddle = hi - lo > 1
      const desc = hasMiddle
        ? `所选起 / 终点之间的途经点已被忽略（高德骑行不支持途经点）`
        : undefined
      toast.success(`已在新标签打开高德${navName}`, { description: desc, duration: 5000 })
    }
  }

  /**
   * 重载：优先调用外部 onReload（重新规划路线），未传时回退到地图全览
   * 这样无论是否在规划过程中按钮都有可见效果，避免「看上去没反应」
   */
  function handleReload() {
    if (onReload) {
      onReload()
      return
    }
    const overlays: unknown[] = [...markersRef.current]
    if (polylineRef.current) overlays.push(polylineRef.current)
    if (overlays.length === 0) {
      toast.message("当前没有点位")
      return
    }
    mapRef.current?.setFitView(overlays, false, [80, 80, 200, 80], 16)
    toast.message("视野已重置")
  }

  /**
   * 定位到用户当前 GPS 位置
   * - 浏览器 Geolocation 拿到的是 WGS84，需要走 AMap.convertFrom 转 GCJ02 才能在高德地图上对齐
   * - 失败时 toast 提示原因（拒绝授权 / 不可用 / 超时）
   */
  function handleLocate() {
    const map = mapRef.current
    const AMap = amapNsRef.current
    if (!map || !AMap) return

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("当前浏览器不支持定位")
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const wgsLng = pos.coords.longitude
        const wgsLat = pos.coords.latitude

        const applyOnMap = (lng: number, lat: number) => {
          map.setZoomAndCenter(16, [lng, lat])
          // 移除上次的位置 marker
          if (userLocationMarkerRef.current) {
            map.remove(userLocationMarkerRef.current)
          }
          // 蓝色脉冲圆点 marker
          const dom = document.createElement("div")
          dom.style.cssText = `
            width:18px;height:18px;border-radius:50%;
            background:#2563eb;border:3px solid #fff;
            box-shadow:0 0 0 2px rgba(37,99,235,.35),0 4px 12px rgba(37,99,235,.5);
          `
          const marker = new AMap.Marker({
            position: [lng, lat],
            content: dom,
            offset: new AMap.Pixel(-9, -9),
            zIndex: 200,
            title: "我的位置",
          })
          map.add(marker)
          userLocationMarkerRef.current = marker
          toast.success("已定位到当前位置", {
            description: `${lng.toFixed(5)}, ${lat.toFixed(5)}`,
          })
          setLocating(false)
        }

        // WGS84 -> GCJ02
        if (typeof AMap.convertFrom === "function") {
          AMap.convertFrom([wgsLng, wgsLat], "gps", (status, result) => {
            if (status === "complete" && result.locations && result.locations.length > 0) {
              const { lng, lat } = result.locations[0]
              applyOnMap(lng, lat)
            } else {
              // 转换失败兜底��直接用原始坐标（误差几十米到几百米）
              console.warn("[v0] convertFrom 失败，使用原始 WGS84 坐标:", result)
              applyOnMap(wgsLng, wgsLat)
            }
          })
        } else {
          applyOnMap(wgsLng, wgsLat)
        }
      },
      (err) => {
        setLocating(false)
        let msg = "定位失败"
        let hint = err.message
        if (err.code === err.PERMISSION_DENIED) {
          msg = "未授权定位"
          hint = "请在浏览器地址栏左侧的权限设置中允许本站访问位置信息"
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "位置信息不可用"
          hint = "GPS 信号弱或设备无定位能力，请稍后重试"
        } else if (err.code === err.TIMEOUT) {
          msg = "定位超时"
          hint = "网络或 GPS 信号弱，请到开阔位置重试"
        }
        toast.error(msg, { description: hint, duration: 6000 })
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 30_000,
      },
    )
  }

  return (
    <div className="relative flex-1 min-w-0 min-h-0 h-full overflow-hidden bg-muted">
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      {/* 顶部状态条：仅在加载中 / 加载失败时显示，加载完成后隐藏不再占位 */}
      {status !== "ready" && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-card border border-border rounded-md shadow-sm px-2.5 py-1.5">
          {status === "loading" && (
            <>
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              <span className="text-[12px] font-medium">加载地图中…</span>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="size-3.5 text-destructive" />
              <span className="text-[12px] font-medium text-destructive">地图加载失败</span>
            </>
          )}
        </div>
      )}

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

      {/* 顶部工具栏：桌面端「拉起导航 | 图层 | 重载」横排；移动端仅纵向「图层 / 重载」纯图标 */}
      <MapTopToolbar
        layer={layer}
        onLayerChange={setLayer}
        onReload={handleReload}
        onLaunchNav={handleLaunchNav}
        canLaunchNav={waypoints.length >= 2}
      />

      {/* 骑行模式：路况图例 —— 放在左上角，避免与右上角工具栏重叠 */}
      {status === "ready" && layer === "cycling" && (
        <div className="absolute top-3 left-3 z-10 bg-card border border-border rounded-md shadow-sm px-2.5 py-1.5 flex items-center gap-2.5">
          <span className="text-[11px] text-muted-foreground font-medium">路况</span>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-foreground">畅通</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" />
            <span className="text-[11px] text-foreground">缓行</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-500" />
            <span className="text-[11px] text-foreground">拥堵</span>
          </div>
        </div>
      )}

      {/* 右侧缩放 + 右下角操作区（定位 / 移动端拉起导航纯图标） */}
      <MapZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onLocate={handleLocate}
        onLaunchNav={status === "ready" ? handleLaunchNav : undefined}
        canLaunchNav={waypoints.length >= 2}
        locating={locating}
        elevationVisible={Boolean(route && elevation.length > 0 && !hideElevation)}
      />

      {/* 海拔剖面：移动端通过 hideElevation 外移到搜索栏与地图之间，这里仅在桌面端覆盖渲染 */}
      {!hideElevation && route && elevation.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <ElevationProfile data={elevation} />
          </div>
        </div>
      )}

      {/* 拉起导航前的「起 / 终点选择」对话框（桌面 + 移动共用） */}
      <NavLaunchDialog
        open={navDialogOpen}
        onOpenChange={setNavDialogOpen}
        waypoints={waypoints}
        onConfirm={launchWithIndices}
      />
    </div>
  )
}
