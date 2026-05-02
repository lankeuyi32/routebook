/**
 * 路线规划接入层
 *
 * 高德官方骑行路径规划接口：
 *   v5: https://restapi.amap.com/v5/direction/bicycling
 *   JS API: AMap.Bicycling 插件
 *
 * 推荐方案：
 * - 后端代理调用 v5 骑行 API，返回 path（经纬度数组）、distance、duration、steps
 * - 海拔/爬升/最大坡度通过高德 Web 服务高程查询或第三方高程数据（如 OpenTopoData、SRTM）补全
 * - 前端只调用自家 /api/route/plan 与 /api/route/elevation
 */

import type { LngLat, RoutePlanResult, ElevationPoint, Waypoint } from "@/types/route"
import { mockPlanRoute, mockElevationProfile } from "@/lib/mock/mock-route"

const USE_REAL_API = false

/**
 * 根据点位列表规划骑行路线
 *
 * 生产对接：
 *   POST /api/route/plan
 *   body: { origin, destination, waypoints }
 *   -> 后端调用 https://restapi.amap.com/v5/direction/bicycling
 *   -> 返回 RoutePlanResult
 */
export async function planRoute(waypoints: Waypoint[]): Promise<RoutePlanResult> {
  if (waypoints.length < 2) {
    throw new Error("至少需要两个点位才能规划路线")
  }

  if (USE_REAL_API) {
    const res = await fetch("/api/route/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: waypoints[0].poi.location,
        destination: waypoints[waypoints.length - 1].poi.location,
        waypoints: waypoints.slice(1, -1).map((w) => w.poi.location),
      }),
    })
    if (!res.ok) throw new Error(`路线规划失败：${res.status}`)
    return (await res.json()) as RoutePlanResult
  }

  // ⚠️ 仅用于 UI 预览，正式接入时通过 USE_REAL_API=true 切换到后端代理
  await new Promise((r) => setTimeout(r, 600))
  return mockPlanRoute(waypoints)
}

/**
 * 根据路线点采样海拔
 *
 * 生产对接：
 *   POST /api/route/elevation
 *   body: { path: LngLat[] }
 *   -> 后端调用高程数据源（高德高程接口 / OpenTopoData / 自建 DEM）
 */
export async function fetchElevationProfile(path: LngLat[]): Promise<ElevationPoint[]> {
  if (USE_REAL_API) {
    const res = await fetch("/api/route/elevation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    })
    if (!res.ok) throw new Error(`海拔获取失败：${res.status}`)
    return (await res.json()) as ElevationPoint[]
  }

  // ⚠️ 仅用于 UI 预览
  await new Promise((r) => setTimeout(r, 200))
  return mockElevationProfile(path)
}
