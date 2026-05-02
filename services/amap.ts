/**
 * 高德地图地点搜索 / POI 接入层（前端调用）
 *
 * 安全约束：
 * - 高德 Web 服务 Key (AMAP_WEB_KEY) 仅在服务端 Route Handler 中读取，绝不暴露前端。
 * - 前端只调 /api/amap/* 自家路由，由服务端转发到高德。
 * - 高德 JS API 的 Web 端 Key (NEXT_PUBLIC_AMAP_KEY) 才允许在浏览器中使用，
 *   且需在高德控制台配置域名白名单。
 *
 * 官方文档：
 * - 输入提示：https://lbs.amap.com/api/webservice/guide/api/inputtips
 * - 关键字搜索：https://lbs.amap.com/api/webservice/guide/api/search
 * - 逆地理：https://lbs.amap.com/api/webservice/guide/api/georegeo
 */

import type { AmapPOI } from "@/types/route"

export interface SearchOptions {
  /** 关键字 */
  keywords: string
  /** 城市编码或城市名，留空则全国搜索 */
  city?: string
  /** 单页条数 */
  pageSize?: number
  /** 页码 */
  page?: number
}

/** 关键字搜索（输入提示 + 关键字检索兜底） */
export async function searchPlaces(options: SearchOptions): Promise<AmapPOI[]> {
  const { keywords } = options
  if (!keywords.trim()) return []

  const params = new URLSearchParams({
    keywords,
    ...(options.city ? { city: options.city } : {}),
    ...(options.pageSize ? { pageSize: String(options.pageSize) } : {}),
    ...(options.page ? { page: String(options.page) } : {}),
  })
  const res = await fetch(`/api/amap/search?${params.toString()}`)
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error ?? `搜索失败：${res.status}`)
  }
  const data = (await res.json()) as { pois: AmapPOI[] }
  return data.pois
}

/** 逆地理编码：根据经纬度获取地址（用于地图点选添加点位） */
export async function reverseGeocode(lng: number, lat: number): Promise<AmapPOI | null> {
  const res = await fetch(`/api/amap/regeo?location=${lng},${lat}`)
  if (!res.ok) return null
  return (await res.json()) as AmapPOI
}

/** 浏览器端 JS API Key */
export function getAmapJsKey(): string | null {
  return process.env.NEXT_PUBLIC_AMAP_KEY ?? null
}

/** 浏览器端 JS API 安全密钥 */
export function getAmapSecurityCode(): string | null {
  return process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? null
}
