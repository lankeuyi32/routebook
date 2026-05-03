"use client"

import { AlertCircle, Loader2, Maximize2, Trash2, Route as RouteIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PlanError {
  message: string
  hint?: string
  code?: string
}

interface Props {
  canPlan: boolean
  planning: boolean
  hasRoute: boolean
  onPlan: () => void
  onOverview: () => void
  onClear: () => void
  error?: PlanError | null
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
        <div className="mt-2.5 rounded-md border border-destructive/30 bg-destructive/8 px-2.5 py-2">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-destructive leading-snug break-all">
                {error.message}
                {error.code && (
                  <span className="ml-1.5 text-[10px] font-mono text-destructive/70">
                    · {error.code}
                  </span>
                )}
              </div>
              {error.hint && (
                <div className="mt-1 text-[11px] text-destructive/85 leading-relaxed">
                  {error.hint}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
