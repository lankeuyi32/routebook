/**
 * 路线规划接入层（前端调用）
 *
 * - 路径规划：调用自家 /api/route/plan，由服务端转发至高德
 *   v5 骑行：https://restapi.amap.com/v5/direction/bicycling
 *
 * - 海拔剖面：高德 Web 服务并未公开提供 DEM 高程接口。
 *   当前实现使用本地估算（基于路径距离生成平滑曲线），
 *   留出可扩展接入点：未来可对接 OpenTopoData / SRTM30 / 自建 DEM。
 *   接口签名保持稳定：fetchElevationProfile(path) -> ElevationPoint[]
 */

import type { LngLat, RoutePlanResult, ElevationPoint, Waypoint } from "@/types/route"
import { estimateElevationProfile } from "@/lib/elevation"

/** 根据点位列表规划骑行路线 */
export async function planRoute(waypoints: Waypoint[]): Promise<RoutePlanResult> {
  if (waypoints.length < 2) {
    throw new Error("至少需要两个点位才能规划路线")
  }
  const res = await fetch("/api/route/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: waypoints[0].poi.location,
      destination: waypoints[waypoints.length - 1].poi.location,
      waypoints: waypoints.slice(1, -1).map((w) => w.poi.location),
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error ?? `路线规划失败：${res.status}`)
  }
  const result = (await res.json()) as RoutePlanResult

  // 估算爬升 / 下降 / 最大坡度（基于本地海拔估算，仅供参考）
  const elevation = estimateElevationProfile(result.path)
  let ascent = 0
  let descent = 0
  let maxGrade = 0
  for (let i = 1; i < elevation.length; i++) {
    const dy = elevation[i].elevation - elevation[i - 1].elevation
    const dx = elevation[i].distance - elevation[i - 1].distance
    if (dy > 0) ascent += dy
    else descent -= dy
    if (dx > 0) {
      const grade = Math.abs(dy / dx) * 100
      if (grade > maxGrade) maxGrade = grade
    }
  }
  result.ascent = Math.round(ascent)
  result.descent = Math.round(descent)
  result.maxGrade = Math.round(maxGrade * 10) / 10

  return result
}

/** 海拔剖面（基于路径估算；后续可替换为真实 DEM 服务） */
export async function fetchElevationProfile(path: LngLat[]): Promise<ElevationPoint[]> {
  return estimateElevationProfile(path)
}
