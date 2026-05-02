import type { SpeedProfile } from "@/types/route"

export const SPEED_PROFILES: SpeedProfile[] = [
  { level: "leisure", label: "休闲", speed: 12 },
  { level: "regular", label: "常规", speed: 18 },
  { level: "challenge", label: "挑战", speed: 25 },
]

/** 米 -> 公里字符串 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/** 秒 -> 时分字符串 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h <= 0) return `${m} 分钟`
  return `${h} 小时 ${m} 分`
}

/** 根据距离与速度（km/h）估算耗时（秒） */
export function estimateDurationBySpeed(distanceMeters: number, speedKmh: number): number {
  if (speedKmh <= 0) return 0
  return Math.round((distanceMeters / 1000 / speedKmh) * 3600)
}
