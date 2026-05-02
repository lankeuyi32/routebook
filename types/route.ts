/**
 * 数据类型定义
 * 字段命名与高德地图 Web 服务 API / JS API 返回结构对齐：
 * - 地点搜索：https://lbs.amap.com/api/webservice/guide/api/search
 * - 路径规划：https://lbs.amap.com/api/webservice/guide/api/newroute
 * - JS API：https://lbs.amap.com/api/javascript-api-v2/summary
 */

/** 经纬度坐标 [lng, lat]，与高德 GCJ-02 坐标系一致 */
export type LngLat = [number, number]

/** 高德 POI（地点）数据结构，对齐高德地点搜索 API tip / poi 返回字段 */
export interface AmapPOI {
  /** 高德 POI 唯一 ID */
  id: string
  /** POI 名称 */
  name: string
  /** 详细地址 */
  address: string
  /** "lng,lat" 字符串格式，与高德 location 字段一致 */
  location: string
  /** 解析后的经纬度，便于前端使用 */
  lngLat: LngLat
  /** 省份 */
  pname?: string
  /** 城市 */
  cityname?: string
  /** 区县 */
  adname?: string
  /** POI 类型 */
  typecode?: string
}

/** 路线点位（用户添加到行程中的点） */
export interface Waypoint {
  /** 前端生成的本地唯一 ID */
  uid: string
  /** 来源 POI */
  poi: AmapPOI
  /** 角色：起点 / 途经 / 终点（由顺序自动推导，但可缓存） */
  role: "start" | "via" | "end"
}

/** 高德路径规划返回的步骤（简化）*/
export interface RouteStep {
  instruction: string
  distance: number
  duration: number
  polyline: LngLat[]
}

/** 高德骑行路径规划结果（对齐 v5 直接返回字段） */
export interface RoutePlanResult {
  /** 路径总距离（米） */
  distance: number
  /** 预计耗时（秒） */
  duration: number
  /** 路线全部经纬度点（用于绘制 polyline） */
  path: LngLat[]
  /** 详细步骤 */
  steps: RouteStep[]
  /** 累计爬升（米），来源于后端高程接口或第三方服务 */
  ascent?: number
  /** 累计下降（米） */
  descent?: number
  /** 最大坡度（百分比） */
  maxGrade?: number
}

/** 海拔剖面单个采样点 */
export interface ElevationPoint {
  /** 距离起点（米） */
  distance: number
  /** 海拔（米） */
  elevation: number
  /** 该点对应的经纬度 */
  lngLat: LngLat
}

/** 骑行速度档位 */
export type SpeedLevel = "leisure" | "regular" | "challenge"

export interface SpeedProfile {
  level: SpeedLevel
  label: string
  speed: number // km/h
}

/** 导出格式 */
export type ExportFormat = "gpx" | "tcx" | "kml" | "csv"
