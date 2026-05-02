/**
 * ⚠️ 仅用于 v0 预览环境的 UI mock 数据
 * ⚠️ 正式接入高德地图 API 时，请删除本文件或将 services/amap.ts 中的
 *    USE_REAL_API 设为 true，使其不再被引用。
 *
 * 数据字段刻意保留为空字符串或合理占位，以避免在 UI 中误以为真实数据。
 */

import type { AmapPOI } from "@/types/route"

const SAMPLE_POIS: AmapPOI[] = [
  {
    id: "MOCK_B0FFFAB6J2",
    name: "示例点位 · 城市公园",
    address: "示例地址 1 号",
    location: "116.397428,39.90923",
    lngLat: [116.397428, 39.90923],
    pname: "示例省",
    cityname: "示例市",
    adname: "示例区",
    typecode: "110100",
  },
  {
    id: "MOCK_B0FFFCDDE1",
    name: "示例点位 · 滨江骑行道",
    address: "示例滨江路",
    location: "116.412345,39.91234",
    lngLat: [116.412345, 39.91234],
    pname: "示例省",
    cityname: "示例市",
    adname: "示例区",
    typecode: "190100",
  },
  {
    id: "MOCK_B0FFFE99A1",
    name: "示例点位 · 山顶观景台",
    address: "示例山路东段",
    location: "116.44567,39.92456",
    lngLat: [116.44567, 39.92456],
    pname: "示例省",
    cityname: "示例市",
    adname: "示例区",
    typecode: "110200",
  },
  {
    id: "MOCK_B0FFFF1122",
    name: "示例点位 · 湖畔补给站",
    address: "示例湖路 88 号",
    location: "116.46789,39.93678",
    lngLat: [116.46789, 39.93678],
    pname: "示例省",
    cityname: "示例市",
    adname: "示例区",
    typecode: "060100",
  },
  {
    id: "MOCK_B0FFFGGAB3",
    name: "示例点位 · 终点广场",
    address: "示例广场北门",
    location: "116.49012,39.94789",
    lngLat: [116.49012, 39.94789],
    pname: "示例省",
    cityname: "示例市",
    adname: "示例区",
    typecode: "110100",
  },
]

/**
 * 仅用于预览：根据关键词在 sample 中模糊匹配
 * 当 keyword 没有命中任何样例时，返回带 keyword 后缀的占位结果，便于演示交互
 */
export function mockSearchPOIs(keyword: string): AmapPOI[] {
  const k = keyword.trim()
  if (!k) return []

  const matched = SAMPLE_POIS.filter(
    (p) => p.name.includes(k) || (p.address && p.address.includes(k)),
  )

  if (matched.length > 0) return matched

  // 生成带关键词的占位 POI（只为演示空状态/搜索流程）
  return SAMPLE_POIS.slice(0, 3).map((p, idx) => ({
    ...p,
    id: `${p.id}_${idx}`,
    name: `${k} · 相关点位 ${idx + 1}`,
    address: `${k} 关键词附近示例地址`,
  }))
}
