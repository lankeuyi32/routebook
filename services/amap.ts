/**
 * 高德地图地点搜索 / POI 接入层
 *
 * 安全约束：
 * - 高德 Web 服务 Key 严禁出现在前端 bundle 中。
 * - 本文件统一调用自家后端代理（Next.js Route Handler 或独立后端），
 *   后端再使用环境变量 AMAP_WEB_SERVICE_KEY 转发到高德。
 * - 高德 JS API 的 Web 端 Key 才允许在浏览器中使用，且需在高德控制台配置域名白名单。
 *
 * 官方文档：
 * - 输入提示：https://lbs.amap.com/api/webservice/guide/api/inputtips
 * - 关键字搜索：https://lbs.amap.com/api/webservice/guide/api/search
 * - 周边搜索：https://lbs.amap.com/api/webservice/guide/api/around
 *
 * v0 预览环境下未配置后端代理时，会回退到 mock 数据（仅用于 UI 预览）。
 */

import type { AmapPOI } from "@/types/route"
import { mockSearchPOIs } from "@/lib/mock/mock-pois"

/** 是否启用真实后端 API（生产环境置为 true，并实现对应 Route Handler） */
const USE_REAL_API = false

export interface SearchOptions {
  /** 关键字 */
  keywords: string
  /** 城市编码或城市名，留空则全国搜索，对应高德 city 参数 */
  city?: string
  /** 单页条数 */
  pageSize?: number
  /** 页码 */
  page?: number
}

/**
 * 输入提示 / 关键字搜索
 *
 * 生产对接：
 *   GET /api/amap/search?keywords=xxx&city=xxx
 *   -> 后端调用 https://restapi.amap.com/v3/place/text 或 /v3/assistant/inputtips
 *   -> 透传 tips/pois 字段
 */
export async function searchPlaces(options: SearchOptions): Promise<AmapPOI[]> {
  const { keywords } = options
  if (!keywords.trim()) return []

  if (USE_REAL_API) {
    const params = new URLSearchParams({
      keywords,
      ...(options.city ? { city: options.city } : {}),
      ...(options.pageSize ? { pageSize: String(options.pageSize) } : {}),
      ...(options.page ? { page: String(options.page) } : {}),
    })
    const res = await fetch(`/api/amap/search?${params.toString()}`)
    if (!res.ok) throw new Error(`搜索失败：${res.status}`)
    const data = (await res.json()) as { pois: AmapPOI[] }
    return data.pois
  }

  // ⚠️ 仅用于 UI 预览，正式接入时通过 USE_REAL_API=true 切换到后端代理
  await new Promise((r) => setTimeout(r, 300))
  return mockSearchPOIs(keywords)
}

/**
 * 逆地理编码：根据经纬度获取地址
 * 生产对接：
 *   GET /api/amap/regeo?location=lng,lat
 *   -> 后端调用 https://restapi.amap.com/v3/geocode/regeo
 */
export async function reverseGeocode(lng: number, lat: number): Promise<AmapPOI | null> {
  if (USE_REAL_API) {
    const res = await fetch(`/api/amap/regeo?location=${lng},${lat}`)
    if (!res.ok) return null
    return (await res.json()) as AmapPOI
  }
  return null
}

/**
 * 在 v0 预览环境中安全获取 JS API Key
 * 生产环境请通过 NEXT_PUBLIC_AMAP_JS_KEY 注入，并在高德控制台配置域名白名单
 */
export function getAmapJsKey(): string | null {
  if (typeof process === "undefined") return null
  return process.env.NEXT_PUBLIC_AMAP_JS_KEY ?? null
}
