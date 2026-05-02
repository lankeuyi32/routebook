/**
 * 高德骑行路径规划代理（服务端）
 *
 * 文档：
 *   v5: https://restapi.amap.com/v5/direction/bicycling
 *   字段：origin, destination, waypoints（;分隔，最多 16 个）, alternative_route, show_fields
 *
 * POST /api/route/plan
 * body: { origin: "lng,lat", destination: "lng,lat", waypoints: ["lng,lat", ...] }
 * -> 返回 RoutePlanResult
 */

import { NextResponse } from "next/server"
import type { RoutePlanResult, RouteStep, LngLat } from "@/types/route"

interface AmapBicyclingPath {
  distance: string | number
  duration: string | number
  steps?: Array<{
    instruction?: string
    step_distance?: string | number
    cost?: { duration?: string | number }
    polyline?: string
  }>
}

interface AmapBicyclingResp {
  status?: string
  errcode?: number
  errmsg?: string
  info?: string
  route?: {
    origin?: string
    destination?: string
    paths?: AmapBicyclingPath[]
  }
  data?: {
    paths?: AmapBicyclingPath[]
  }
}

function parsePolyline(polyline?: string): LngLat[] {
  if (!polyline) return []
  return polyline
    .split(";")
    .map((seg) => {
      const [lng, lat] = seg.split(",").map(Number)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      return [lng, lat] as LngLat
    })
    .filter((x): x is LngLat => x !== null)
}

export async function POST(req: Request) {
  const key = process.env.AMAP_WEB_KEY
  if (!key) {
    return NextResponse.json({ error: "AMAP_WEB_KEY 未配置" }, { status: 500 })
  }

  let body: { origin?: string; destination?: string; waypoints?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "无效的 JSON 请求体" }, { status: 400 })
  }
  const { origin, destination, waypoints = [] } = body
  if (!origin || !destination) {
    return NextResponse.json({ error: "缺少 origin / destination" }, { status: 400 })
  }

  // 高德骑行最多支持 16 个途经点
  const safeWaypoints = waypoints.slice(0, 16)

  const params = new URLSearchParams({
    key,
    origin,
    destination,
    show_fields: "cost,navi,polyline",
  })
  if (safeWaypoints.length > 0) {
    params.set("waypoints", safeWaypoints.join(";"))
  }

  const res = await fetch(
    `https://restapi.amap.com/v5/direction/bicycling?${params.toString()}`,
    { cache: "no-store" },
  )
  if (!res.ok) {
    return NextResponse.json({ error: `高德 API 请求失败：${res.status}` }, { status: 502 })
  }
  const data = (await res.json()) as AmapBicyclingResp

  // v5 返回结构：{ data: { paths: [...] } } 或 { route: { paths: [...] } }
  const paths = data.data?.paths ?? data.route?.paths
  if (!paths || paths.length === 0) {
    return NextResponse.json(
      { error: data.errmsg ?? data.info ?? "未找到可用骑行路线" },
      { status: 502 },
    )
  }

  const path0 = paths[0]
  const steps: RouteStep[] = []
  const fullPath: LngLat[] = []

  for (const s of path0.steps ?? []) {
    const seg = parsePolyline(s.polyline)
    if (seg.length === 0) continue
    // 拼接时避免重复点
    if (fullPath.length === 0) {
      fullPath.push(...seg)
    } else {
      const last = fullPath[fullPath.length - 1]
      const first = seg[0]
      if (last[0] === first[0] && last[1] === first[1]) {
        fullPath.push(...seg.slice(1))
      } else {
        fullPath.push(...seg)
      }
    }
    steps.push({
      instruction: s.instruction ?? "",
      distance: Number(s.step_distance ?? 0),
      duration: Number(s.cost?.duration ?? 0),
      polyline: seg,
    })
  }

  const result: RoutePlanResult = {
    distance: Number(path0.distance ?? 0),
    duration: Number(path0.duration ?? 0),
    path: fullPath,
    steps,
  }

  return NextResponse.json(result)
}
