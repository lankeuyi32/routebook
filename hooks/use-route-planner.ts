"use client"

import { useCallback, useMemo, useState } from "react"
import type { AmapPOI, ElevationPoint, RoutePlanResult, SpeedLevel, Waypoint } from "@/types/route"
import { planRoute as planRouteApi } from "@/services/route"
import { fetchElevationProfile } from "@/services/route"

function genUid() {
  return `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function useRoutePlanner() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [route, setRoute] = useState<RoutePlanResult | null>(null)
  const [elevation, setElevation] = useState<ElevationPoint[]>([])
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState<{
    message: string
    hint?: string
    code?: string
  } | null>(null)
  const [speedLevel, setSpeedLevel] = useState<SpeedLevel>("regular")

  const addWaypoint = useCallback((poi: AmapPOI) => {
    setWaypoints((prev) => {
      // 避免重复添加同一个 POI
      if (prev.some((w) => w.poi.id === poi.id)) return prev
      const next: Waypoint = {
        uid: genUid(),
        poi,
        role: prev.length === 0 ? "start" : "end",
      }
      return [...prev, next]
    })
  }, [])

  /** 批量加点（导入文件时使用），同一次调用内同步追加 */
  const addWaypoints = useCallback((pois: AmapPOI[]) => {
    setWaypoints((prev) => {
      const existing = new Set(prev.map((w) => w.poi.id))
      const additions: Waypoint[] = []
      for (const poi of pois) {
        if (existing.has(poi.id)) continue
        existing.add(poi.id)
        additions.push({ uid: genUid(), poi, role: "via" })
      }
      return [...prev, ...additions]
    })
  }, [])

  const removeWaypoint = useCallback((uid: string) => {
    setWaypoints((prev) => prev.filter((w) => w.uid !== uid))
  }, [])

  const removeWaypoints = useCallback((uids: string[]) => {
    const set = new Set(uids)
    setWaypoints((prev) => prev.filter((w) => !set.has(w.uid)))
  }, [])

  const reorderWaypoints = useCallback((fromIndex: number, toIndex: number) => {
    setWaypoints((prev) => {
      if (fromIndex === toIndex) return prev
      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setWaypoints([])
    setRoute(null)
    setElevation([])
    setPlanError(null)
  }, [])

  const planRoute = useCallback(async () => {
    if (waypoints.length < 2) {
      setPlanError({ message: "至少需要两个点位才能规划路线" })
      return
    }
    setPlanning(true)
    setPlanError(null)
    try {
      const result = await planRouteApi(waypoints)
      setRoute(result)
      const elev = await fetchElevationProfile(result.path)
      setElevation(elev)
    } catch (e) {
      const err = e as Error & { hint?: string; code?: string }
      setPlanError({
        message: err.message || "路线规划失败",
        hint: err.hint,
        code: err.code,
      })
      setRoute(null)
      setElevation([])
    } finally {
      setPlanning(false)
    }
  }, [waypoints])

  /** 自动派生角色（起点 / 途经 / 终点） */
  const decoratedWaypoints = useMemo<Waypoint[]>(() => {
    return waypoints.map((w, idx, arr) => ({
      ...w,
      role: idx === 0 ? "start" : idx === arr.length - 1 ? "end" : "via",
    }))
  }, [waypoints])

  return {
    waypoints: decoratedWaypoints,
    route,
    elevation,
    planning,
    planError,
    speedLevel,
    setSpeedLevel,
    addWaypoint,
    addWaypoints,
    removeWaypoint,
    removeWaypoints,
    reorderWaypoints,
    clearAll,
    planRoute,
  }
}
