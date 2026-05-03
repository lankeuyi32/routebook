"use client"

import { useMemo, useState } from "react"
import type { ElevationPoint } from "@/types/route"
import { formatDistance } from "@/lib/route-utils"
import { cn } from "@/lib/utils"
import { TrendingUp } from "lucide-react"

interface Props {
  data: ElevationPoint[]
  className?: string
}

export function ElevationProfile({ data, className }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const stats = useMemo(() => {
    if (data.length === 0) return null
    let min = data[0].elevation
    let max = data[0].elevation
    let minIdx = 0
    let maxIdx = 0
    for (let i = 0; i < data.length; i++) {
      if (data[i].elevation < min) {
        min = data[i].elevation
        minIdx = i
      }
      if (data[i].elevation > max) {
        max = data[i].elevation
        maxIdx = i
      }
    }
    return { min, max, minIdx, maxIdx, total: data[data.length - 1].distance }
  }, [data])

  if (data.length === 0 || !stats) return null

  const W = 1000
  const H = 140
  const PAD_T = 18
  const PAD_B = 22
  const PAD_L = 44
  const PAD_R = 12

  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const totalDist = stats.total || 1
  const yMin = Math.floor(stats.min - 10)
  const yMax = Math.ceil(stats.max + 10)
  const yRange = yMax - yMin || 1

  function xOf(i: number) {
    return PAD_L + (data[i].distance / totalDist) * innerW
  }
  function yOf(v: number) {
    return PAD_T + innerH - ((v - yMin) / yRange) * innerH
  }

  const linePath = data.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i)} ${yOf(p.elevation)}`).join(" ")
  const areaPath = `${linePath} L ${xOf(data.length - 1)} ${PAD_T + innerH} L ${PAD_L} ${PAD_T + innerH} Z`

  const yTicks = [yMin, yMin + yRange / 2, yMax]
  const xTickCount = 5
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => (totalDist * i) / xTickCount)

  const current = hoverIdx !== null ? data[hoverIdx] : null

  /** 通用「客户端 X 坐标 → data 索引」 */
  function pickIndexByClientX(svg: SVGSVGElement, clientX: number) {
    const rect = svg.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * W
    if (px < PAD_L || px > W - PAD_R) {
      setHoverIdx(null)
      return
    }
    const dist = ((px - PAD_L) / innerW) * totalDist
    // 二分查找最近点
    let lo = 0
    let hi = data.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (data[mid].distance < dist) lo = mid + 1
      else hi = mid
    }
    setHoverIdx(lo)
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    pickIndexByClientX(e.currentTarget, e.clientX)
  }

  function handleTouch(e: React.TouchEvent<SVGSVGElement>) {
    const t = e.touches[0]
    if (!t) return
    pickIndexByClientX(e.currentTarget, t.clientX)
  }

  return (
    <div className={cn("bg-card border-t border-border", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="size-3.5 text-foreground" />
          <span className="text-[12px] font-medium">海拔剖面</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <Stat label="当前海拔" value={current ? `${current.elevation} m` : "--"} />
          <Stat label="最高点" value={`${stats.max} m`} accent="text-emerald-600" />
          <Stat label="最低点" value={`${stats.min} m`} accent="text-rose-600" />
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-[140px] block touch-none"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onTouchEnd={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* horizontal gridlines */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="2 3"
                className="text-foreground"
              />
              <text
                x={PAD_L - 6}
                y={yOf(t) + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {Math.round(t)}m
              </text>
            </g>
          ))}

          <path d={areaPath} fill="url(#elev-fill)" />
          <path d={linePath} fill="none" stroke="#64748b" strokeWidth="1.5" />

          {/* x ticks */}
          {xTicks.map((d, i) => (
            <text
              key={i}
              x={PAD_L + (d / totalDist) * innerW}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="10"
            >
              {formatDistance(d)}
            </text>
          ))}

          {current && hoverIdx !== null && (
            <g>
              <line
                x1={xOf(hoverIdx)}
                x2={xOf(hoverIdx)}
                y1={PAD_T}
                y2={PAD_T + innerH}
                stroke="#2563eb"
                strokeOpacity="0.4"
                strokeDasharray="2 2"
              />
              <circle
                cx={xOf(hoverIdx)}
                cy={yOf(current.elevation)}
                r="3.5"
                fill="#2563eb"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums text-foreground", accent)}>{value}</span>
    </div>
  )
}
