import { ImageResponse } from "next/og"

// 苹果触摸图标 — Next.js App Router 自动接管 /apple-icon
// 用 ImageResponse 在构建/运行时把 JSX 渲染成 PNG，自带圆角与透明像素
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#10B981",
        borderRadius: 40,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={140}
        height={140}
        fill="none"
      >
        <path
          d="M16 46 C 22 42, 22 32, 32 32 C 42 32, 42 22, 48 18"
          stroke="#FFFFFF"
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={16} cy={46} r={4} fill="#FFFFFF" />
        <circle cx={32} cy={32} r={2.5} fill="#FFFFFF" />
        <circle cx={48} cy={18} r={5} fill="none" stroke="#FFFFFF" strokeWidth={3} />
        <circle cx={48} cy={18} r={1.5} fill="#FFFFFF" />
      </svg>
    </div>,
    { ...size },
  )
}
