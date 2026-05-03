/**
 * 高德 API 服务端调用辅助：超时 + 重试 + 错误归一化。
 *
 * 现实问题：从无服务器 / sandbox 出口偶发 ETIMEDOUT 连不上 restapi.amap.com，
 * 简单的一次性 fetch 会让整条请求 500，但其实再试一次就成功。
 */

export interface FetchAmapOptions {
  /** 单次请求超时（毫秒），默认 7000 */
  timeoutMs?: number
  /** 总尝试次数（含首次），默认 2 */
  retries?: number
  /** 重试间隔（毫秒），默认 300 */
  retryDelayMs?: number
}

export async function fetchAmap(
  url: string,
  options: FetchAmapOptions = {},
): Promise<Response> {
  const { timeoutMs = 7000, retries = 2, retryDelayMs = 300 } = options

  let lastError: unknown = null
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      })
      return res
    } catch (e) {
      lastError = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[v0] fetchAmap 第 ${attempt}/${retries} 次失败:`, msg)
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelayMs))
      }
    }
  }
  // 全部重试失败
  throw lastError ?? new Error("fetchAmap 网络异常")
}

/** 把 fetch 错误转成给前端的友好提示 */
export function networkErrorPayload(e: unknown): {
  error: string
  hint: string
  code: string
} {
  const raw = e instanceof Error ? e.message : String(e)
  if (/ETIMEDOUT|timed out|timeout|aborted/i.test(raw)) {
    return {
      error: "连接高德服务超时",
      hint: "服务器到 restapi.amap.com 网络抖动，请稍后重试。本错误与 Key 权限无关。",
      code: "NETWORK_TIMEOUT",
    }
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(raw)) {
    return {
      error: "无法解析高德域名",
      hint: "服务器 DNS 解析 restapi.amap.com 失败，请检查容器/网络环境。",
      code: "DNS_FAIL",
    }
  }
  return {
    error: "网络异常",
    hint: raw,
    code: "NETWORK_ERROR",
  }
}
