/**
 * 高德骑行路径规划代理（服务端）
 *
 * 重要：高德骑行规划 v5（/v5/direction/bicycling）**不支持 waypoints 参数**，
 * 一旦传入会返回 21002 HAVE_NO_PERMISSION（"请求服务不存在"）。
 *
 * 正确做法：把 N 个点位拆成 N-1 段「起→终」串行调用，再把所有 path / steps /
 * 距离 / 时长拼接起来。这是高德官方推荐的多途经点骑行规划方式。
 *
 * POST /api/route/plan
 * body: { origin, destination, waypoints?: string[] }
 */

import { NextResponse } from "next/server"
import { fetchAmap, networkErrorPayload } from "@/lib/fetch-amap"
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
  route?: { paths?: AmapBicyclingPath[] }
  data?: { paths?: AmapBicyclingPath[] }
}

function explainAmapError(code: string, info: string): { title: string; hint: string } {
  switch (code) {
    case "10001":
      return { title: "Key 无效", hint: "AMAP_WEB_KEY 不存在或已被删除" }
    case "10003":
      return {
        title: "今日配额已用完",
        hint: "个人 Web 服务 Key 每日 5000 次免费额度已用尽，明日 0 点重置",
      }
    case "10004":
      return { title: "请求过于频繁", hint: "QPS 超限（个人 Key 50/秒），请稍后重试" }
    case "10005":
    case "10010":
      return { title: "IP 白名单限制", hint: "请到高德控制台关闭 IP 白名单或加入服务器 IP" }
    case "10009":
      return {
        title: "Key 类型不匹配",
        hint: "本接口需要『Web 服务』Key，不是『Web 端 (JS API)』Key",
      }
    case "10012":
    case "10024":
      return {
        title: "Key 未开通『路径规划』服务",
        hint: "高德控制台 → 应用管理 → 编辑服务 → 勾选「Web 服务 API」下的『路径规划』",
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
      return { title: "单段距离超过 500 km", hint: "请减少途经点之间的距离" }
    case "21002":
      return {
        title: "请求服务不存在",
        hint: "代码侧错误：骑行规划 v5 不支持 waypoints 参数，请联系开发者",
      }
    case "30000":
      return { title: "高德服务端临时错误", hint: "请稍后重试" }
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

/** 调用一次高德骑行规划（仅起+终），返回首选路径或抛错 */
async function planSegment(
  key: string,
  origin: string,
  destination: string,
): Promise<AmapBicyclingPath> {
  const params = new URLSearchParams({
    key,
    origin,
    destination,
    show_fields: "cost,navi,polyline",
  })
  const res = await fetchAmap(
    `https://restapi.amap.com/v5/direction/bicycling?${params.toString()}`,
  )
  if (!res.ok) {
    throw new Error(`高德 HTTP ${res.status}`)
  }
  const data = (await res.json()) as AmapBicyclingResp
  const ok = data.status === "1" || data.errcode === 0
  if (!ok) {
    const code = String(data.errcode ?? data.infocode ?? "")
    const info = data.errmsg ?? data.info ?? "未知错误"
    const { title, hint } = explainAmapError(code, info)
    const err: Error & { code?: string; hint?: string } = new Error(title)
    err.code = code
    err.hint = hint
    throw err
  }
  const paths = data.data?.paths ?? data.route?.paths
  if (!paths || paths.length === 0) {
    const err: Error & { code?: string; hint?: string } = new Error("未找到骑行路线")
    err.code = "NO_PATH"
    err.hint = "请把起终点选在主干道上"
    throw err
  }
  return paths[0]
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

  // 把整条路线拆成连续的 N-1 段「起→终」
  const sequence = [origin, ...waypoints, destination]
  const segments: Array<[string, string]> = []
  for (let i = 0; i < sequence.length - 1; i++) {
    segments.push([sequence[i], sequence[i + 1]])
  }
  console.log(`[v0] 骑行规划：共 ${segments.length} 段串行请求`)

  try {
    let totalDistance = 0
    let totalDuration = 0
    const fullPath: LngLat[] = []
    const allSteps: RouteStep[] = []

    for (let i = 0; i < segments.length; i++) {
      const [from, to] = segments[i]
      const path = await planSegment(key, from, to)
      totalDistance += Number(path.distance ?? 0)
      totalDuration += Number(path.duration ?? 0)

      for (const s of path.steps ?? []) {
        const seg = parsePolyline(s.polyline)
        if (seg.length === 0) continue
        // 跨段拼接时跳过重复首点
        if (fullPath.length > 0) {
          const last = fullPath[fullPath.length - 1]
          const first = seg[0]
          if (last[0] === first[0] && last[1] === first[1]) {
            fullPath.push(...seg.slice(1))
          } else {
            fullPath.push(...seg)
          }
        } else {
          fullPath.push(...seg)
        }
        allSteps.push({
          instruction: s.instruction ?? "",
          distance: Number(s.step_distance ?? 0),
          duration: Number(s.cost?.duration ?? 0),
          polyline: seg,
        })
      }
    }

    const result: RoutePlanResult = {
      distance: totalDistance,
      duration: totalDuration,
      path: fullPath,
      steps: allSteps,
    }
    return NextResponse.json(result)
  } catch (e) {
    // 业务错误：高德返回错误码
    if (e instanceof Error && (e as Error & { code?: string }).code) {
      const ee = e as Error & { code?: string; hint?: string }
      console.error("[v0] amap bicycling error:", { code: ee.code, message: ee.message })
      return NextResponse.json(
        {
          error: ee.message,
          hint: ee.hint ?? "",
          code: ee.code,
        },
        { status: 502 },
      )
    }
    // 网络错误：超时 / DNS 等
    const payload = networkErrorPayload(e)
    console.error("[v0] amap bicycling network error:", payload)
    return NextResponse.json(payload, { status: 502 })
  }
}
