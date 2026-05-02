/**
 * 高德地点搜索代理（服务端）
 *
 * 调用链：
 *   前端 fetch /api/amap/search?keywords=xxx&city=xxx
 *   -> 本路由调用 https://restapi.amap.com/v3/assistant/inputtips（输入提示）
 *   -> 不足时再回退到 https://restapi.amap.com/v3/place/text（关键字搜索）
 *   -> 统一映射成 AmapPOI[] 返回
 *
 * 安全：仅在服务端读取 AMAP_WEB_KEY，绝不返回给前端。
 * 文档：
 *   https://lbs.amap.com/api/webservice/guide/api/inputtips
 *   https://lbs.amap.com/api/webservice/guide/api/search
 */

import { NextResponse } from "next/server"
import type { AmapPOI } from "@/types/route"

const AMAP_BASE = "https://restapi.amap.com"

interface AmapTip {
  id?: string
  name: string
  district?: string
  adcode?: string
  location?: string | string[]
  address?: string | string[]
  typecode?: string
}

interface AmapPoi {
  id: string
  name: string
  address?: string | string[]
  location: string
  pname?: string
  cityname?: string
  adname?: string
  typecode?: string
}

function toLngLat(location: string): [number, number] | null {
  if (!location || typeof location !== "string") return null
  const parts = location.split(",")
  if (parts.length !== 2) return null
  const lng = Number(parts[0])
  const lat = Number(parts[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

function normalizeStr(v: string | string[] | undefined): string {
  if (!v) return ""
  if (Array.isArray(v)) return v.join("")
  return v
}

export async function GET(req: Request) {
  const key = process.env.AMAP_WEB_KEY
  if (!key) {
    return NextResponse.json({ error: "AMAP_WEB_KEY 未配置" }, { status: 500 })
  }

  const url = new URL(req.url)
  const keywords = url.searchParams.get("keywords")?.trim() ?? ""
  const city = url.searchParams.get("city")?.trim() ?? ""
  const pageSize = url.searchParams.get("pageSize") ?? "15"
  const page = url.searchParams.get("page") ?? "1"

  if (!keywords) {
    return NextResponse.json({ pois: [] })
  }

  // 1. 输入提示（更适合搜索框联想）
  const tipParams = new URLSearchParams({
    key,
    keywords,
    datatype: "all",
    ...(city ? { city } : {}),
  })
  const tipRes = await fetch(`${AMAP_BASE}/v3/assistant/inputtips?${tipParams.toString()}`, {
    cache: "no-store",
  })

  if (!tipRes.ok) {
    return NextResponse.json({ error: `高德 API 请求失败：${tipRes.status}` }, { status: 502 })
  }

  const tipData = (await tipRes.json()) as { status: string; info?: string; tips?: AmapTip[] }
  if (tipData.status !== "1") {
    return NextResponse.json({ error: tipData.info ?? "高德 API 错误" }, { status: 502 })
  }

  let pois: AmapPOI[] = (tipData.tips ?? [])
    .filter((t) => {
      const loc = typeof t.location === "string" ? t.location : ""
      return Boolean(loc && toLngLat(loc))
    })
    .map<AmapPOI>((t) => {
      const loc = typeof t.location === "string" ? t.location : ""
      const lngLat = toLngLat(loc)!
      return {
        id: t.id ?? `${t.name}-${loc}`,
        name: t.name,
        address: normalizeStr(t.address),
        location: loc,
        lngLat,
        adname: t.district,
        typecode: t.typecode,
      }
    })

  // 2. 若联想结果不足，调 place/text 兜底
  if (pois.length < 5) {
    const placeParams = new URLSearchParams({
      key,
      keywords,
      offset: pageSize,
      page,
      ...(city ? { city } : {}),
      extensions: "base",
    })
    const placeRes = await fetch(`${AMAP_BASE}/v3/place/text?${placeParams.toString()}`, {
      cache: "no-store",
    })
    if (placeRes.ok) {
      const placeData = (await placeRes.json()) as {
        status: string
        pois?: AmapPoi[]
      }
      if (placeData.status === "1" && placeData.pois) {
        const extra: AmapPOI[] = []
        for (const p of placeData.pois) {
          const lngLat = toLngLat(p.location)
          if (!lngLat) continue
          extra.push({
            id: p.id,
            name: p.name,
            address: normalizeStr(p.address),
            location: p.location,
            lngLat,
            pname: p.pname,
            cityname: p.cityname,
            adname: p.adname,
            typecode: p.typecode,
          })
        }
        // 合并去重
        const seen = new Set(pois.map((p) => p.id))
        for (const p of extra) {
          if (!seen.has(p.id)) {
            pois.push(p)
            seen.add(p.id)
          }
        }
      }
    }
  }

  return NextResponse.json({ pois: pois.slice(0, Number(pageSize) || 15) })
}
