"use client"

import { useMemo, useState } from "react"
import { Search, MapPin, Plus, Loader2, Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { searchPlaces } from "@/services/amap"
import type { AmapPOI } from "@/types/route"
import { cn } from "@/lib/utils"

interface Props {
  onSelect: (poi: AmapPOI) => void
  /** 已添加点位 ID，用于在结果列表上展示 “已添加” 状态 */
  addedIds?: Set<string>
  /** 关闭面板（仅由父级 FAB 或面板内关闭按钮触发） */
  onClose: () => void
}

/**
 * 移动端：地图右上角向左展开的搜索面板。
 * - 行为上仅由父级 FAB 二次点击或面板内关闭按钮收起，不监听点击外部
 * - 选中点位后保留面板（继续添加多个点），由用户自行关闭
 */
export function MobileSearchPanel({ onSelect, addedIds, onClose }: Props) {
  const [keyword, setKeyword] = useState("")
  const [results, setResults] = useState<AmapPOI[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [filterKw, setFilterKw] = useState("")

  const filtered = useMemo(() => {
    const kw = filterKw.trim().toLowerCase()
    if (!kw) return results
    return results.filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        p.address.toLowerCase().includes(kw) ||
        (p.cityname?.toLowerCase().includes(kw) ?? false) ||
        (p.adname?.toLowerCase().includes(kw) ?? false),
    )
  }, [results, filterKw])

  async function handleSearch() {
    if (!keyword.trim()) return
    setLoading(true)
    setTouched(true)
    setError(null)
    setFilterKw("")
    try {
      const data = await searchPlaces({ keywords: keyword.trim() })
      setResults(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "搜索失败")
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-card">
      {/* 头部：标题 + 关闭 */}
      <div className="shrink-0 px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium text-foreground leading-tight">地点搜索</h2>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            高德 POI · 添加为路线点位
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="收起搜索"
          className="size-7 shrink-0 rounded hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* 输入区 */}
      <div className="shrink-0 px-3 py-2.5 border-b border-border space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="输入地点名称"
              className="h-9 pl-8 text-[13px]"
              autoFocus
            />
          </div>
          <Button
            size="icon"
            onClick={handleSearch}
            disabled={loading || !keyword.trim()}
            className="size-9 shrink-0"
            aria-label="搜索"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </Button>
        </div>

        {!loading && results.length > 0 && (
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              value={filterKw}
              onChange={(e) => setFilterKw(e.target.value)}
              placeholder={`在 ${results.length} 条结果中筛选`}
              className="h-7 pl-7 pr-7 text-[12px]"
            />
            {filterKw && (
              <button
                type="button"
                onClick={() => setFilterKw("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="清除筛选"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 结果列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {loading && (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 mr-2 animate-spin" /> 正在搜索...
          </div>
        )}

        {!loading && error && (
          <div className="px-3 py-4 text-xs text-destructive">{error}</div>
        )}

        {!loading && !error && !touched && (
          <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
            输入关键词后开始搜索
          </div>
        )}

        {!loading && !error && touched && results.length === 0 && (
          <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
            未找到与 &ldquo;{keyword}&rdquo; 相关的地点
          </div>
        )}

        {!loading && results.length > 0 && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
            没有匹配 &ldquo;{filterKw}&rdquo; 的结果
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <ul className="divide-y divide-border">
            {filtered.map((poi) => {
              const added = addedIds?.has(poi.id)
              return (
                <li key={poi.id}>
                  <button
                    type="button"
                    onClick={() => !added && onSelect(poi)}
                    disabled={added}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-start gap-2.5",
                      added && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    <div className="mt-0.5 size-5 shrink-0 rounded-full bg-secondary flex items-center justify-center">
                      <MapPin className="size-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground truncate">
                        {poi.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {poi.address}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        {(poi.cityname || poi.adname) && (
                          <span className="px-1.5 py-0.5 rounded bg-secondary truncate max-w-[140px]">
                            {[poi.cityname, poi.adname].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "shrink-0 size-6 rounded flex items-center justify-center",
                        added
                          ? "bg-secondary text-muted-foreground"
                          : "bg-foreground text-background",
                      )}
                    >
                      {added ? (
                        <span className="text-[10px]">已加</span>
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
