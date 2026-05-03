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

  // iOS 14+ 推荐用 location.href，iframe 方式已不可靠
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

  return { platform, attempts, truncatedWaypoints: hasWaypoints }
}
