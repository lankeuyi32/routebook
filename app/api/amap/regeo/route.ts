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
import { fetchAmap, networkErrorPayload } from "@/lib/fetch-amap"
import type { AmapPOI } from "@/types/route"

interface RegeoNearbyPoi {
  id?: string
  name?: string
  type?: string
  distance?: string
  location?: string
  address?: string | string[]
  businessarea?: string
}

interface RegeoNearbyRoad {
  id?: string
  name?: string
  distance?: string
  direction?: string
  location?: string
}

interface RegeoResponse {
  status: string
  info?: string
  regeocode?: {
    formatted_address?: string
    addressComponent?: {
      province?: string
      city?: string | string[]
      district?: string
      township?: string
      adcode?: string
      streetNumber?: {
        street?: string
        number?: string
        direction?: string
        distance?: string
      }
    }
    pois?: RegeoNearbyPoi[]
    roads?: RegeoNearbyRoad[]
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
    // all 才会返回最近 POI 和道路，用于给"地图随手点选"赋予合理的名称
    extensions: "all",
    radius: "200",
    poitype: "",
  })

  let data: RegeoResponse
  try {
    const res = await fetchAmap(
      `https://restapi.amap.com/v3/geocode/regeo?${params.toString()}`,
    )
    if (!res.ok) {
      return NextResponse.json({ error: `高德 API 请求失败：${res.status}` }, { status: 502 })
    }
    data = (await res.json()) as RegeoResponse
  } catch (e) {
    return NextResponse.json(networkErrorPayload(e), { status: 502 })
  }
  if (data.status !== "1" || !data.regeocode) {
    return NextResponse.json({ error: data.info ?? "高德 API 错误" }, { status: 502 })
  }

  const [lng, lat] = location.split(",").map(Number)
  const cityRaw = data.regeocode.addressComponent?.city
  const city = Array.isArray(cityRaw) ? cityRaw.join("") : (cityRaw ?? "")

  // 选一个最贴近用户点击位置的"名称"：优先取最近 POI（≤50m），其次取最近道路 + "附近"，再次取乡镇/街道，最后兜底
  const name = pickFriendlyName(data.regeocode, city)

  const poi: AmapPOI = {
    id: `MAP_${location}`,
    name,
    address: data.regeocode.formatted_address || location,
    location,
    lngLat: [lng, lat],
    pname: data.regeocode.addressComponent?.province,
    cityname: city,
    adname: data.regeocode.addressComponent?.district,
  }
  return NextResponse.json(poi)
}

/** 从 regeo 结果里挑一个用户最容易识别的"名称" */
function pickFriendlyName(
  regeo: NonNullable<RegeoResponse["regeocode"]>,
  city: string,
): string {
  // 1) 最近 POI（≤50 米直接当名称，≤200 米附加"附近"）
  const pois = regeo.pois ?? []
  const sortedPois = [...pois]
    .filter((p) => p.name && p.distance)
    .sort((a, b) => Number(a.distance) - Number(b.distance))
  if (sortedPois.length > 0) {
    const nearest = sortedPois[0]
    const dist = Number(nearest.distance ?? 0)
    if (dist <= 50) return nearest.name as string
    if (dist <= 200) return `${nearest.name}附近`
  }

  // 2) 最近道路
  const roads = regeo.roads ?? []
  const sortedRoads = [...roads]
    .filter((r) => r.name && r.distance)
    .sort((a, b) => Number(a.distance) - Number(b.distance))
  if (sortedRoads.length > 0) {
    return `${sortedRoads[0].name}附近`
  }

  // 3) 街道号
  const sn = regeo.addressComponent?.streetNumber
  if (sn?.street) {
    return sn.number ? `${sn.street} ${sn.number}号附近` : `${sn.street}附近`
  }

  // 4) 乡镇/街道
  const township = regeo.addressComponent?.township
  if (township) return `${township}附近`

  // 5) 区县
  const district = regeo.addressComponent?.district
  if (district) return `${district}附近`

  // 6) 兜底
  return city ? `${city}地图点选` : "地图点选位置"
}
