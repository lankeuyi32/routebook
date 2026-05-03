/**
 * 拉起高德 App / Web 进行骑行导航
 * 策略：移动端优先尝试 App URL Scheme（t=3 骑行），1.6s 内未离开页面则回落到 Web URI
 * - iOS  : iosamap://path?...&t=3
 * - Android: amapuri://route/plan?...&t=3
 * - 桌面/微信内置/未安装 App: 走 https://uri.amap.com/navigation
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

export type LaunchPlatform = "ios" | "android" | "wechat" | "desktop"

export interface LaunchResult {
  platform: LaunchPlatform
  /** 实际尝试的 URL（按尝试顺序排列） */
  attempts: string[]
  /** 是否多点路线（途经点会被丢弃，仅用起终点） */
  truncatedWaypoints: boolean
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
 * 构建高德 App scheme（iOS / Android）
 * 文档：https://lbs.amap.com/api/uri-api/guide/mobile-web/route
 */
function buildAppScheme(platform: "ios" | "android", from: NavPoint, to: NavPoint): string {
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

/** 构建 Web 兜底 URI */
function buildWebUri(from: NavPoint, to: NavPoint): string {
  const params = new URLSearchParams({
    from: `${from.lng},${from.lat},${from.name}`,
    to: `${to.lng},${to.lat},${to.name}`,
    mode: "ride",
    src: "route-planner",
    coordinate: "gaode",
    callnative: "1",
  })
  return `https://uri.amap.com/navigation?${params.toString()}`
}

/**
 * 主入口：拉起导航。
 * 桌面/微信 → 直接新标签打开 Web；移动 → 先试 App scheme，1.6s 内未跳走则跳 Web。
 */
export function launchAmapNav(from: NavPoint, to: NavPoint, hasWaypoints: boolean): LaunchResult {
  const platform = detectPlatform()
  const webUri = buildWebUri(from, to)
  const attempts: string[] = []

  if (platform === "desktop" || platform === "wechat") {
    attempts.push(webUri)
    window.open(webUri, "_blank", "noopener,noreferrer")
    return { platform, attempts, truncatedWaypoints: hasWaypoints }
  }

  // 移动端：优先 App scheme
  const appUri = buildAppScheme(platform, from, to)
  attempts.push(appUri)

  // 用一个隐藏 iframe 尝试跳转，避免直接 location.href 在 iOS 失败时触发系统报错
  // iOS 14+ 需要 location.href 才能可靠唤起，iframe 已不可靠 → 直接 location.href
  const startTs = Date.now()
  let fallbackTimer: number | null = null

  const fallbackToWeb = () => {
    if (document.hidden) return // 已经离开页面，说明 App 拉起成功
    if (Date.now() - startTs < 800) return // 太快，说明 scheme 立即报错，仍走 Web
    attempts.push(webUri)
    window.open(webUri, "_blank", "noopener,noreferrer")
  }

  // 监听 visibilitychange：App 起来时页面会被隐藏
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
    // ignore
  }

  // 1.6s 兜底：仍可见 → 跳 Web
  fallbackTimer = window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisChange)
    fallbackToWeb()
    fallbackTimer = null
  }, 1600)

  return { platform, attempts, truncatedWaypoints: hasWaypoints }
}
