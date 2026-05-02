"use client"

import type { RoutePlanResult, SpeedLevel } from "@/types/route"
import {
  estimateDurationBySpeed,
  formatDistance,
  formatDuration,
  SPEED_PROFILES,
} from "@/lib/route-utils"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Mountain, Clock, Gauge } from "lucide-react"

interface Props {
  route: RoutePlanResult | null
  speedLevel: SpeedLevel
  onSpeedChange: (level: SpeedLevel) => void
}

export function RouteStats({ route, speedLevel, onSpeedChange }: Props) {
  if (!route) return null

  const profile = SPEED_PROFILES.find((p) => p.level === speedLevel) ?? SPEED_PROFILES[1]
  const estDuration = estimateDurationBySpeed(route.distance, profile.speed)

  const stats = [
    {
      label: "总里程",
      value: formatDistance(route.distance),
      icon: <Gauge className="size-3 text-muted-foreground" />,
    },
    {
      label: "预计耗时",
      value: formatDuration(estDuration),
      icon: <Clock className="size-3 text-muted-foreground" />,
    },
    {
      label: "爬升",
      value: route.ascent !== undefined ? `${route.ascent} m` : "--",
      icon: <TrendingUp className="size-3 text-emerald-600" />,
    },
    {
      label: "下降",
      value: route.descent !== undefined ? `${route.descent} m` : "--",
      icon: <TrendingDown className="size-3 text-rose-600" />,
    },
    {
      label: "最大坡度",
      value: route.maxGrade !== undefined ? `${route.maxGrade}%` : "--",
      icon: <Mountain className="size-3 text-muted-foreground" />,
    },
  ]

  return (
    <section className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-medium text-foreground">路线统计</h2>
        <span className="text-[11px] text-muted-foreground">基于规划结果</span>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-border">
          <Stat label="总里程" value={stats[0].value} highlight />
          <Stat label="预计耗时" value={stats[1].value} highlight />
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
          <Stat label="爬升" value={stats[2].value} icon={stats[2].icon} small />
          <Stat label="下降" value={stats[3].value} icon={stats[3].icon} small />
          <Stat label="最大坡度" value={stats[4].value} icon={stats[4].icon} small />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground">骑行速度参考</span>
          <span className="text-[11px] text-foreground font-medium">
            {profile.label} {profile.speed}km/h
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-secondary rounded-md">
          {SPEED_PROFILES.map((p) => (
            <button
              key={p.level}
              onClick={() => onSpeedChange(p.level)}
              className={cn(
                "rounded text-[12px] py-1.5 font-medium transition-colors",
                speedLevel === p.level
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
              <span className="block text-[10px] font-normal text-muted-foreground">
                {p.speed}km/h
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  icon,
  highlight,
  small,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  highlight?: boolean
  small?: boolean
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 font-semibold text-foreground tabular-nums",
          highlight ? "text-lg" : small ? "text-[13px]" : "text-base",
        )}
      >
        {value}
      </div>
    </div>
  )
}
