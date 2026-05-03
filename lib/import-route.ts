/**
 * 本地路线文件解析（纯前端，不走后端）
 *
 * 支持格式：
 * - GPX 1.1 (`<wpt>` / `<rtept>` / `<trkpt>`)
 * - TCX (`<Trackpoint><Position>`)
 * - KML (`<Placemark><Point><coordinates>`、`<LineString><coordinates>`)
 * - CSV（按 lng,lat,name? 解析，第一行可选表头）
 *
 * 输出统一为 AmapPOI[]，并自动 WGS-84 → GCJ-02 转换以匹配高德地图坐标系。
 */

import type { AmapPOI } from "@/types/route"
import { wgs84ToGcj02 } from "@/lib/coord"

export type ImportFormat = "gpx" | "tcx" | "kml" | "csv"

export interface ImportResult {
  format: ImportFormat
  /** 解析得到的点位（已转为 GCJ-02） */
  pois: AmapPOI[]
  /** 路线总点数（包括 polyline 上的 trkpt），仅做统计 */
  totalTrackPoints: number
  /** 路线名称（取自文件元数据） */
  name?: string
  /** 提示信息（例如 trkpt 太多时只抽样几个加为途经点） */
  notice?: string
}

/** 入口：根据扩展名分发到具体解析器 */
export async function parseRouteFile(file: File): Promise<ImportResult> {
  const text = await file.text()
  const ext = (file.name.split(".").pop() ?? "").toLowerCase()

  if (ext === "gpx") return parseGpx(text, file.name)
  if (ext === "tcx") return parseTcx(text, file.name)
  if (ext === "kml") return parseKml(text, file.name)
  if (ext === "csv") return parseCsv(text, file.name)

  // 没有扩展名时根据内容嗅探
  if (text.includes("<gpx")) return parseGpx(text, file.name)
  if (text.includes("<TrainingCenterDatabase")) return parseTcx(text, file.name)
  if (text.includes("<kml")) return parseKml(text, file.name)
  if (/-?\d+\.\d+\s*,\s*-?\d+\.\d+/.test(text)) return parseCsv(text, file.name)

  throw new Error("无法识别的文件格式，仅支持 GPX / TCX / KML / CSV")
}

// ──────────────────────────── GPX ────────────────────────────

function parseGpx(xml: string, filename: string): ImportResult {
  const doc = parseXml(xml)
  const name = doc.querySelector("metadata > name")?.textContent?.trim() || filename

  // 优先级：wpt（标记点） > rtept（路线点） > trkpt（轨迹点）
  const wpts = Array.from(doc.querySelectorAll("wpt"))
  const rtepts = Array.from(doc.querySelectorAll("rtept"))
  const trkpts = Array.from(doc.querySelectorAll("trkpt"))

  let pois: AmapPOI[] = []
  let notice: string | undefined

  if (wpts.length > 0) {
    pois = wpts.map((el, i) => xmlPointToPoi(el, i, "GPX_WPT"))
  } else if (rtepts.length > 0) {
    pois = rtepts.map((el, i) => xmlPointToPoi(el, i, "GPX_RTE"))
  } else if (trkpts.length > 0) {
    // 轨迹点通常成千上万个，做下抽样：保留 ≤ 20 个作为途经点
    const samples = sample(trkpts, 20)
    pois = samples.map((el, i) => xmlPointToPoi(el, i, "GPX_TRK"))
    notice = `轨迹点共 ${trkpts.length} 个，已抽样 ${samples.length} 个作为途经点`
  } else {
    throw new Error("GPX 文件中未找到任何坐标点")
  }

  return {
    format: "gpx",
    pois,
    totalTrackPoints: trkpts.length || rtepts.length || wpts.length,
    name,
    notice,
  }
}

// ──────────────────────────── TCX ────────────────────────────

function parseTcx(xml: string, filename: string): ImportResult {
  const doc = parseXml(xml)
  const name =
    doc.querySelector("Activity > Id")?.textContent?.trim() ||
    doc.querySelector("Course > Name")?.textContent?.trim() ||
    filename

  const trackpoints = Array.from(doc.querySelectorAll("Trackpoint"))
  const positioned = trackpoints.filter((tp) => tp.querySelector("Position"))
  if (positioned.length === 0) {
    throw new Error("TCX 文件中未找到带坐标的 Trackpoint")
  }
  const samples = sample(positioned, 20)
  const pois = samples.map((tp, i) => {
    const lat = Number(tp.querySelector("Position > LatitudeDegrees")?.textContent ?? 0)
    const lng = Number(tp.querySelector("Position > LongitudeDegrees")?.textContent ?? 0)
    const time = tp.querySelector("Time")?.textContent?.trim()
    return makePoi(`TCX_${i}`, time ? `轨迹点 ${i + 1}` : `轨迹点 ${i + 1}`, lng, lat, time)
  })

  return {
    format: "tcx",
    pois,
    totalTrackPoints: positioned.length,
    name,
    notice:
      positioned.length > samples.length
        ? `轨迹点共 ${positioned.length} 个，已抽样 ${samples.length} 个`
        : undefined,
  }
}

// ──────────────────────────── KML ────────────────────────────

function parseKml(xml: string, filename: string): ImportResult {
  const doc = parseXml(xml)
  const name = doc.querySelector("Document > name")?.textContent?.trim() || filename

  const placemarks = Array.from(doc.querySelectorAll("Placemark"))
  const pois: AmapPOI[] = []
  let lineCoordsCount = 0

  for (const pm of placemarks) {
    const pmName = pm.querySelector("name")?.textContent?.trim()
    const pointCoord = pm.querySelector("Point > coordinates")?.textContent?.trim()
    if (pointCoord) {
      const parsed = parseKmlCoord(pointCoord)
      if (parsed) {
        pois.push(makePoi(`KML_PM_${pois.length}`, pmName || `点 ${pois.length + 1}`, parsed[0], parsed[1]))
      }
    }
    const lineCoord = pm.querySelector("LineString > coordinates")?.textContent?.trim()
    if (lineCoord) {
      const points = lineCoord
        .split(/\s+/)
        .map((s) => parseKmlCoord(s))
        .filter((p): p is [number, number] => p !== null)
      lineCoordsCount += points.length
      // 给整条 LineString 抽样作为途经点
      const samples = sample(points, 10)
      samples.forEach((p, i) => {
        pois.push(makePoi(`KML_LS_${pois.length}`, pmName ? `${pmName} ${i + 1}` : `路线 ${i + 1}`, p[0], p[1]))
      })
    }
  }

  if (pois.length === 0) {
    throw new Error("KML 文件中未找到任何坐标点")
  }

  return {
    format: "kml",
    pois,
    totalTrackPoints: pois.length + lineCoordsCount,
    name,
  }
}

function parseKmlCoord(s: string): [number, number] | null {
  const parts = s.split(",").map(Number)
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null
  return [parts[0], parts[1]] // KML: lng,lat,alt?
}

// ──────────────────────────── CSV ────────────────────────────

function parseCsv(text: string, filename: string): ImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) throw new Error("CSV 文件为空")

  // 检测表头：如果第一行不能解析为数字，跳过
  const firstCols = lines[0].split(",")
  const hasHeader = !Number.isFinite(Number(firstCols[0]))
  const dataLines = hasHeader ? lines.slice(1) : lines

  const pois: AmapPOI[] = []
  for (let i = 0; i < dataLines.length; i++) {
    const cols = dataLines[i].split(",").map((s) => s.trim())
    if (cols.length < 2) continue
    const lng = Number(cols[0])
    const lat = Number(cols[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    const name = cols[2] || `点 ${i + 1}`
    pois.push(makePoi(`CSV_${i}`, name, lng, lat))
  }

  if (pois.length === 0) {
    throw new Error("CSV 中未找到有效的 lng,lat 行；预期格式：lng,lat,name?")
  }

  return {
    format: "csv",
    pois,
    totalTrackPoints: pois.length,
    name: filename,
  }
}

// ──────────────────────────── 工具函数 ────────────────────────────

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml")
  const err = doc.querySelector("parsererror")
  if (err) throw new Error("XML 解析失败：文件内容不合法")
  return doc
}

function xmlPointToPoi(el: Element, index: number, idPrefix: string): AmapPOI {
  const lat = Number(el.getAttribute("lat") ?? 0)
  const lng = Number(el.getAttribute("lon") ?? 0)
  const name = el.querySelector("name")?.textContent?.trim() || `点 ${index + 1}`
  const desc = el.querySelector("desc")?.textContent?.trim()
  return makePoi(`${idPrefix}_${index}`, name, lng, lat, desc)
}

function makePoi(id: string, name: string, wgsLng: number, wgsLat: number, address?: string): AmapPOI {
  const [lng, lat] = wgs84ToGcj02(wgsLng, wgsLat)
  return {
    id,
    name,
    address: address || `${lng.toFixed(5)}, ${lat.toFixed(5)}`,
    location: `${lng},${lat}`,
    lngLat: [lng, lat],
  }
}

/** 等距抽样：当源数组长度 ≤ max 时返回原数组；否则均匀抽样首尾必含 */
function sample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr
  const out: T[] = []
  const step = (arr.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) {
    out.push(arr[Math.round(i * step)])
  }
  return out
}
