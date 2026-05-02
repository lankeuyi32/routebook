/**
 * 海拔估算（本地）
 *
 * 高德 Web 服务未公开 DEM/高程查询接口，因此本工具使用基于经纬度的
 * 多周期正弦合成生成平滑、可重现的伪海拔曲线，仅用于 UI 演示。
 *
 * 真实场景请替换实现为：
 *  - OpenTopoData：https://www.opentopodata.org/
 *  - 自建 SRTM/ASTER GDEM 服务
 *  - Mapbox Tilequery + terrain-rgb
 *
 * 接口契约保持稳定：输入路径点，返回累计距离/海拔/坐标的采样数组。
 */

import type { LngLat, ElevationPoint } from "@/types/route"

const R = 6_371_000 // 地球半径（米）

function haversine(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const dφ = ((lat2 - lat1) * Math.PI) / 180
  const dλ = ((lng2 - lng1) * Math.PI) / 180
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/** 基于坐标的伪随机种子，使同一条路线产生稳定的海拔曲线 */
function seededHeight(lng: number, lat: number, baseline: number): number {
  const a = Math.sin(lng * 53.7 + lat * 41.3) * 18
  const b = Math.cos(lng * 13.1 - lat * 27.9) * 12
  const c = Math.sin((lng + lat) * 7.4) * 8
  return baseline + a + b + c
}

export function estimateElevationProfile(path: LngLat[]): ElevationPoint[] {
  if (!path || path.length === 0) return []
  if (path.length === 1) {
    const [lng, lat] = path[0]
    return [{ distance: 0, elevation: Math.max(0, seededHeight(lng, lat, 50)), lngLat: path[0] }]
  }

  // 1. 计算累计距离
  const cum: number[] = [0]
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + haversine(path[i - 1], path[i]))
  }
  const total = cum[cum.length - 1]
  const baseline = 30 + ((path[0][0] * 1000) % 80)

  // 2. 采样最多 200 个点
  const sampleCount = Math.min(Math.max(40, Math.ceil(total / 200)), 200)
  const out: ElevationPoint[] = []
  for (let i = 0; i < sampleCount; i++) {
    const target = (i / (sampleCount - 1)) * total
    // 二分定位最近线段
    let lo = 0
    let hi = cum.length - 1
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (cum[mid] <= target) lo = mid
      else hi = mid
    }
    const segLen = cum[hi] - cum[lo] || 1
    const t = (target - cum[lo]) / segLen
    const lng = path[lo][0] + (path[hi][0] - path[lo][0]) * t
    const lat = path[lo][1] + (path[hi][1] - path[lo][1]) * t
    const elevation = Math.max(0, Math.round(seededHeight(lng, lat, baseline)))
    out.push({ distance: Math.round(target), elevation, lngLat: [lng, lat] })
  }
  return out
}
