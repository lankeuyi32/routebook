"use client"

import { Loader2, Maximize2, Trash2, Route as RouteIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  canPlan: boolean
  planning: boolean
  hasRoute: boolean
  onPlan: () => void
  onOverview: () => void
  onClear: () => void
  error?: string | null
}

export function RouteActions({
  canPlan,
  planning,
  hasRoute,
  onPlan,
  onOverview,
  onClear,
  error,
}: Props) {
  return (
    <section className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-medium text-foreground">路线操作</h2>
        <span className="text-[11px] text-muted-foreground">高德骑行规划</span>
      </div>

      <Button
        onClick={onPlan}
        disabled={!canPlan || planning}
        className="w-full h-10 text-[13px] font-medium"
      >
        {planning ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" /> 正在规划...
          </>
        ) : (
          <>
            <RouteIcon className="size-4 mr-2" /> 生成路线
          </>
        )}
      </Button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={onOverview}
          disabled={!hasRoute}
          className="h-9 text-[12px]"
        >
          <Maximize2 className="size-3.5 mr-1.5" /> 全览
        </Button>
        <Button
          variant="outline"
          onClick={onClear}
          className="h-9 text-[12px] text-muted-foreground hover:text-destructive hover:border-destructive/40"
        >
          <Trash2 className="size-3.5 mr-1.5" /> 清空路线
        </Button>
      </div>

      {error && (
        <div className="mt-2 text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </section>
  )
}
