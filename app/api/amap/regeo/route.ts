/**
 * 高德逆地理编码代理（服务端）
 *
 * 文档：https://lbs.amap.com/api/webservice/guide/api/georegeo
 *
 * GET /api/amap/regeo?location=lng,lat
 *   -> https://restapi.amap.com/v3/geocode/regeo
 *   -> 返回 AmapPOI（用作"地图点选添加点位"）
 */

import { NextResponse } from "next/server"
import type { AmapPOI } from "@/types/route"

interface RegeoResponse {
  status: string
  info?: string
  regeocode?: {
    formatted_address?: string
    addressComponent?: {
      province?: string
      city?: string | string[]
      district?: string
      adcode?: string
    }
  }
}

export async function GET(req: Request) {
  const key = process.env.AMAP_WEB_KEY
  if (!key) {
    return NextResponse.json({ error: "AMAP_WEB_KEY 未配置" }, { status: 500 })
  }
  const url = new URL(req.url)
  const location = url.searchParams.get("location")?.trim()
  if (!location || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(location)) {
    return NextResponse.json({ error: "location 参数无效" }, { status: 400 })
  }

  const params = new URLSearchParams({
    key,
    location,
    extensions: "base",
  })
  const res = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${params.toString()}`, {
    cache: "no-store",
  })
  if (!res.ok) {
    return NextResponse.json({ error: `高德 API 请求失败：${res.status}` }, { status: 502 })
  }
  const data = (await res.json()) as RegeoResponse
  if (data.status !== "1" || !data.regeocode) {
    return NextResponse.json({ error: data.info ?? "高德 API 错误" }, { status: 502 })
  }

  const [lng, lat] = location.split(",").map(Number)
  const cityRaw = data.regeocode.addressComponent?.city
  const city = Array.isArray(cityRaw) ? cityRaw.join("") : (cityRaw ?? "")

  const poi: AmapPOI = {
    id: `MAP_${location}`,
    name: data.regeocode.formatted_address || "地图点选位置",
    address: data.regeocode.formatted_address || location,
    location,
    lngLat: [lng, lat],
    pname: data.regeocode.addressComponent?.province,
    cityname: city,
    adname: data.regeocode.addressComponent?.district,
  }
  return NextResponse.json(poi)
}
