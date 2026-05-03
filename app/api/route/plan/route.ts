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
  infocode?: string
  route?: {
    origin?: string
    destination?: string
    paths?: AmapBicyclingPath[]
  }
  data?: {
    paths?: AmapBicyclingPath[]
  }
}

/** 把高德错误码翻译成用户能看懂的提示 */
function explainAmapError(code: string, info: string): { title: string; hint: string } {
  switch (code) {
    case "10001":
      return { title: "Key 无效", hint: "AMAP_WEB_KEY 不存在或已被删除，请到高德控制台核对" }
    case "10003":
      return {
        title: "今日配额已用完",
        hint: "个人 Web 服务 Key 每日 5000 次免费额度已用尽，明日 0 点重置或升级配额",
      }
    case "10004":
      return { title: "请求过于频繁", hint: "QPS 超限（个人 Key 50/秒），请稍后重试" }
    case "10005":
    case "10010":
      return { title: "IP 白名单限制", hint: "请到高德控制台关闭 IP 白名单或加入服务器 IP" }
    case "10009":
      return {
        title: "Key 类型不匹配",
        hint: "本接口需要『Web 服务』类型 Key，不是『Web 端 (JS API)』Key。请重新创建并替换 AMAP_WEB_KEY",
      }
    case "10012":
    case "10024":
      return {
        title: "Key 未开通『路径规划』服务",
        hint: "请到高德控制台 → 应用管理 → 找到该 Key → 编辑服务 → 勾选「Web 服务 API」分类下的『路径规划』后保存",
      }
    case "20000":
      return { title: "请求参数非法", hint: "起终点经纬度格式异常" }
    case "20800":
      return {
        title: "起点或终点不在骑行服务范围内",
        hint: "高德骑行只覆盖国内主要城市道路，请检查是否选到了郊区/海外/无骑行路网区域",
      }
    case "20801":
      return { title: "起终点附近找不到可骑行道路", hint: "请把点位拖到正规道路上重试" }
    case "20803":
      return {
        title: "距离超出骑行规划上限（500 km）",
        hint: "请减少途经点之间的距离，或拆成多段规划",
      }
    case "30000":
      return { title: "内部服务异常", hint: "高德服务端临时错误，请稍后重试" }
    default:
      return { title: info || `高德返回错误 ${code}`, hint: "" }
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

  // 优先按业务状态判断（兼容 v5 / v3 不同字段命名）
  const statusOk = data.status === "1" || data.errcode === 0
  if (!statusOk) {
    const code = String(data.errcode ?? data.infocode ?? "")
    const info = data.errmsg ?? data.info ?? "未知错误"
    const { title, hint } = explainAmapError(code, info)
    console.error("[v0] amap bicycling error:", { code, info, title, hint })
    return NextResponse.json(
      {
        error: title,
        hint,
        code,
        rawMessage: info,
      },
      { status: 502 },
    )
  }

  // v5 返回结构：{ data: { paths: [...] } } 或 { route: { paths: [...] } }
  const paths = data.data?.paths ?? data.route?.paths
  if (!paths || paths.length === 0) {
    return NextResponse.json(
      { error: "未找到可用骑行路线", hint: "试着把起终点选在主干道上" },
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
