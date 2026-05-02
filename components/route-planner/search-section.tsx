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
  /** 已添加点位 ID，用于在结果列表上展示 "已添加" 状态 */
  addedIds?: Set<string>
}

export function SearchSection({ onSelect, addedIds }: Props) {
  const [keyword, setKeyword] = useState("")
  const [results, setResults] = useState<AmapPOI[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [filterKw, setFilterKw] = useState("")

  // 二次过滤
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
    <section className="px-4 pt-4 pb-3 border-b border-border">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-medium text-foreground">地点搜索</h2>
        <span className="text-[11px] text-muted-foreground">高德 POI</span>
      </div>

      {/* 主搜索 */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="输入地点名称"
            className="h-9 pl-8 text-[13px]"
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

      {(touched || results.length > 0) && (
        <div className="mt-2.5 rounded-md border border-border bg-card overflow-hidden">
          {/* 二次过滤（仅当有结果时显示） */}
          {!loading && results.length > 0 && (
            <div className="px-2.5 py-1.5 border-b border-border bg-secondary/40">
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  value={filterKw}
                  onChange={(e) => setFilterKw(e.target.value)}
                  placeholder={`在 ${results.length} 条结果中筛选`}
                  className="h-7 pl-7 pr-7 text-[12px] bg-card"
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
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 mr-2 animate-spin" /> 正在搜索...
            </div>
          )}

          {!loading && error && (
            <div className="px-3 py-4 text-xs text-destructive">{error}</div>
          )}

          {!loading && !error && results.length === 0 && touched && (
            <div className="px-3 py-4 text-xs text-muted-foreground">
              未找到与 &ldquo;{keyword}&rdquo; 相关的地点
            </div>
          )}

          {!loading && results.length > 0 && filtered.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground">
              没有匹配 &ldquo;{filterKw}&rdquo; 的结果
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <ul className="max-h-[32vh] overflow-y-auto divide-y divide-border">
              {filtered.map((poi) => {
                const added = addedIds?.has(poi.id)
                return (
                  <li key={poi.id}>
                    <button
                      type="button"
                      onClick={() => !added && onSelect(poi)}
                      disabled={added}
                      className={cn(
                        "w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-start gap-2.5 group",
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
                          <span className="font-mono shrink-0">
                            {poi.lngLat[0].toFixed(4)},{poi.lngLat[1].toFixed(4)}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "shrink-0 size-6 rounded flex items-center justify-center transition-colors",
                          added
                            ? "bg-secondary text-muted-foreground"
                            : "bg-foreground text-background opacity-0 group-hover:opacity-100",
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
      )}
    </section>
  )
}
