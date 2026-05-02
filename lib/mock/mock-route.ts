/**
 * ⚠️ 仅用于 v0 预览环境的 UI mock 数据
 * ⚠️ 正式接入高德地图骑行路径规划 / 海拔接口时，请删除本文件
 *    或将 services/route.ts 中的 USE_REAL_API 设为 true。
 *
 * 这里基于点位经纬度做简易插值，仅用于在地图上呈现折线和海拔曲线，
 * 距离 / 耗时 / 爬升 / 坡度均为粗略估算，不可作为真实数据使用。
 */

import type { Waypoint, LngLat, RoutePlanResult, ElevationPoint } from "@/types/route"

/** 球面距离（米），Haversine 公式 */
function haversine(a: LngLat, b: LngLat): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 在两点间线性插值若干个中间点（仅用于 UI 演示折线） */
function interpolate(a: LngLat, b: LngLat, n: number): LngLat[] {
  const out: LngLat[] = []
  for (let i = 1; i < n; i++) {
    const t = i / n
    // 加一点正弦扰动让折线看起来不像直线，仅用于视觉
    const jitter = Math.sin(t * Math.PI * 4) * 0.0008
    out.push([a[0] + (b[0] - a[0]) * t + jitter, a[1] + (b[1] - a[1]) * t + jitter])
  }
  return out
}

export function mockPlanRoute(waypoints: Waypoint[]): RoutePlanResult {
  const path: LngLat[] = []
  let distance = 0

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i].poi.lngLat
    const b = waypoints[i + 1].poi.lngLat
    if (i === 0) path.push(a)
    path.push(...interpolate(a, b, 24))
    path.push(b)
    distance += haversine(a, b)
  }

  // 骑行均速 18km/h 估算
  const duration = Math.round((distance / 1000 / 18) * 3600)

  return {
    distance: Math.round(distance),
    duration,
    path,
    steps: [],
    ascent: Math.round(distance / 1000) * 12,
    descent: Math.round(distance / 1000) * 9,
    maxGrade: 6.5,
  }
}

export function mockElevationProfile(path: LngLat[]): ElevationPoint[] {
  if (path.length === 0) return []
  let acc = 0
  return path.map((p, i) => {
    if (i > 0) acc += haversine(path[i - 1], p)
    // 用正弦叠加伪造起伏
    const elevation = 80 + Math.sin(i / 8) * 35 + Math.sin(i / 23) * 25 + (i / path.length) * 30
    return {
      distance: Math.round(acc),
      elevation: Math.round(elevation * 10) / 10,
      lngLat: p,
    }
  })
}
