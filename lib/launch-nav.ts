/**
 * 拉起高德 App / Web 进行导航
 *
 * 支持两种模式：
 * - 骑行（ride, t=3）：高德骑行不支持途经点，移动端优先 App scheme，1.6s 未离开页面回落 Web
 * - 驾车（car,  t=0）：支持多途经点（最多 16 个），统一走 Web URI（callnative=1 会在移动端自动尝试唤起 App），
 *                       这样能稳定地把 via 列表带过去，避免不同平台 scheme 对 via 参数支持不一致的问题
 *
 * 高德参数 t 含义：0=驾车 1=公交 2=步行 3=骑行 4=货车
 */

export interface NavPoint {
  /** 高德 GCJ-02 坐标 */
  lng: number
  lat: number
  /** 显示名称 */
  name: string
}

export type NavMode = "ride" | "car"
export type LaunchPlatform = "ios" | "android" | "wechat" | "desktop"

export interface LaunchResult {
  platform: LaunchPlatform
  mode: NavMode
  /** 实际尝试的 URL（按尝试顺序排列） */
  attempts: string[]
  /** 骑行模式下是否丢弃了中间点（驾车模式恒为 false，因为 via 会被透传） */
  truncatedWaypoints: boolean
  /** 实际带上的途经点数量（仅驾车模式有意义） */
  viaCount: number
}

export interface LaunchOptions {
  mode: NavMode
  /** 仅驾车模式生效；按顺序依次途经，最多 16 个 */
  via?: NavPoint[]
}

/** 平台嗅探 */
export function detectPlatform(): LaunchPlatform {
  if (typeof navigator === "undefined") return "desktop"
  const ua = navigator.userAgent.toLowerCase()
  // 微信内置浏览器对自定义 scheme 限制严格，单独识别走 Web 版
  if (/micromessenger/.test(ua)) return "wechat"
  if (/iphone|ipad|ipod/.test(ua)) return "ios"
  if (/android/.test(ua)) return "android"
  return "desktop"
}

/**
 * 构建骑行模式下的高德 App scheme（iOS / Android）
 * 文档：https://lbs.amap.com/api/uri-api/guide/mobile-web/route
 */
function buildRideAppScheme(platform: "ios" | "android", from: NavPoint, to: NavPoint): string {
  const base = platform === "ios" ? "iosamap://path" : "amapuri://route/plan"
  const params = new URLSearchParams({
    sourceApplication: "route-planner",
    sid: "BGVIS1",
    slat: String(from.lat),
    slon: String(from.lng),
    sname: from.name,
    did: "BGVIS2",
    dlat: String(to.lat),
    dlon: String(to.lng),
    dname: to.name,
    dev: "0", // 0=经纬度未偏移（GCJ-02），1=已偏移（WGS-84）
    t: "3",   // 骑行
  })
  return `${base}?${params.toString()}`
}

/**
 * 构建 Web 通用 URI
 * - mode: ride / car / walk / bus
 * - via: 仅驾车 / 步行有效（骑行不支持），格式 `lng,lat,name;lng,lat,name`
 * - callnative=1 在移动端会自动尝试唤起高德 App
 */
function buildWebUri(from: NavPoint, to: NavPoint, mode: NavMode, via: NavPoint[] = []): string {
  const params = new URLSearchParams({
    from: `${from.lng},${from.lat},${from.name}`,
    to: `${to.lng},${to.lat},${to.name}`,
    mode: mode === "car" ? "car" : "ride",
    src: "route-planner",
    coordinate: "gaode",
    callnative: "1",
  })
  if (via.length > 0) {
    // 高德 URI 文档：via 最多 16 个，分号分隔
    const viaStr = via
      .slice(0, 16)
      .map((v) => `${v.lng},${v.lat},${v.name}`)
      .join(";")
    params.set("via", viaStr)
  }
  return `https://uri.amap.com/navigation?${params.toString()}`
}

/**
 * 主入口：拉起导航
 *
 * 骑行（ride）：
 * - 桌面 / 微信   → 直接新标签打开 Web
 * - iOS / Android → 先尝试 App scheme，1.6s 未跳走则回落 Web
 *
 * 驾车（car）：
 * - 不分平台直接打开 Web URI（带 via + callnative=1），由高德页面在移动端自动唤起 App，
 *   这样多途经点能完整传过去
 */
export function launchAmapNav(
  from: NavPoint,
  to: NavPoint,
  options: LaunchOptions,
): LaunchResult {
  const platform = detectPlatform()
  const { mode } = options
  const via = mode === "car" ? (options.via ?? []).slice(0, 16) : []
  const webUri = buildWebUri(from, to, mode, via)
  const attempts: string[] = []

  // 驾车：统一走 Web URI（多途经点最稳）
  if (mode === "car") {
    attempts.push(webUri)
    if (typeof window !== "undefined") {
      window.open(webUri, "_blank", "noopener,noreferrer")
    }
    return {
      platform,
      mode,
      attempts,
      truncatedWaypoints: false,
      viaCount: via.length,
    }
  }

  // 以下为骑行分支（保持与原行为一致）
  if (platform === "desktop" || platform === "wechat") {
    attempts.push(webUri)
    window.open(webUri, "_blank", "noopener,noreferrer")
    return {
      platform,
      mode,
      attempts,
      // 骑行：是否存在被忽略的途经点由调用方传 via 是否非空判断（这里 via 总为空，所以恒 false）
      truncatedWaypoints: false,
      viaCount: 0,
    }
  }

  // 移动端骑行：优先 App scheme
  const appUri = buildRideAppScheme(platform, from, to)
  attempts.push(appUri)

  let fallbackTimer: number | null = null

  // 监听 visibilitychange：App 起来时页面会被隐藏 → 取消兜底
  const onVisChange = () => {
    if (document.hidden && fallbackTimer !== null) {
      window.clearTimeout(fallbackTimer)
      fallbackTimer = null
      document.removeEventListener("visibilitychange", onVisChange)
    }
  }
  document.addEventListener("visibilitychange", onVisChange)

  // 触发 scheme
  try {
    window.location.href = appUri
  } catch {
    // ignore：scheme 解析失败时浏览器吞错，不影响兜底逻辑
  }

  // 1.6s 后页面仍可见 → 说明 App 没拉起，跳 Web 兜底
  fallbackTimer = window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisChange)
    if (!document.hidden) {
      attempts.push(webUri)
      window.open(webUri, "_blank", "noopener,noreferrer")
    }
    fallbackTimer = null
  }, 1600)

  return {
    platform,
    mode,
    attempts,
    truncatedWaypoints: false,
    viaCount: 0,
  }
}
