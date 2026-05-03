# 骑行路书制作 · Cycling Route Planner

> 基于高德地图 JS API 与 Web 服务 API 的专业骑行路线规划工具，支持地点搜索、骑行路径规划、海拔剖面分析、本地文件导入与一键拉起高德 App 骑行导航。

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)

---

## 目录

- [功能特性](#功能特性)
- [在线预览](#在线预览)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
  - [前置要求](#前置要求)
  - [安装](#安装)
  - [环境变量](#环境变量)
  - [运行](#运行)
- [高德 Key 申请与配置](#高德-key-申请与配置)
- [项目结构](#项目结构)
- [使用指南](#使用指南)
- [部署](#部署)
- [常见问题](#常见问题)
- [路线图](#路线图)
- [贡献指南](#贡献指南)
- [许可证](#许可证)
- [致谢](#致谢)

---

## 功能特性

### 路线规划
- **多点骑行路径规划**：支持起点 + N 个途经点 + 终点，自动按相邻顺序拆段调用高德骑行 v5 API 串行规划并拼接。
- **路线统计**：总距离、预估用时（按用户选择的车速档位）、累计爬升 / 下降、最大坡度。
- **海拔剖面图**：基于规划点序列的本地估算海拔，桌面 hover、移动 touch 联动距离/海拔实时显示。

### 地图交互
- **真实高德地图**（@amap/amap-jsapi-loader v2）：标准 / 卫星 / 地形 / 骑行 四种图层。
- **骑行模式**：使用 `amap://styles/fresh` 清新底图 + 实时路况图层（绿/黄/红），右上角附带颜色图例。
- **底图 POI 一键加点**：点击高德底图自带的公园、地铁、商场等标签弹出信息卡，一键加入路线。
- **任意位置加点**：地图任意空白处单击弹出信息卡，名称智能选取（最近 POI ≤50m / 道路 / 街道 / 区县兜底）。
- **GPS 定位**：右下角准星按钮，浏览器 Geolocation → WGS84 转 GCJ02 → 蓝色脉冲圆点标记。
- **自动全览**：仅在点位**数量变化**时 fitView，避免拖拽排序、改名时视野被强制重置。

### 工作面板
- **响应式宽度**：桌面 280 / 320 / 360 / 400 / 440px 五档；移动端切换为「标题→地图→工作区→底栏」垂直布局，向下滚动时标题渐隐。
- **地点搜索浮层**：避免与点位管理抢空间；选中后自动收起；ESC、点击外部、关闭按钮均可手动收起。
- **双重过滤搜索**：搜索结果浮层内 + 点位管理 header，分别过滤候选与已加入点位。
- **拖拽排序**：原生 HTML5 Drag & Drop，过滤状态自动禁用以防索引错位。
- **批量操作**：复选框 + 批量删除；清空带 `window.confirm` 防误操作。

### 文件导入 / 导出
- **本地解析 GPX / TCX / KML / CSV**（纯前端，不上传服务器）。
- **WGS84 → GCJ02 自动偏移**：保证 GPS 文件在高德地图正确对齐。
- **抽样策略**：trkpt / Position / LineString 默认采样上限避免点位过多。

### 拉起导航
- **平台智能分发**：iOS `iosamap://path?t=3` / Android `amapuri://route/plan?t=3` / 桌面与微信走 Web URI。
- **未安装兜底**：监听 `visibilitychange` 检测 App 唤起，1.6s 仍可见则自动跳网页版。
- **骑行模式**：参数 `t=3` 直接进入高德 App 骑行导航。

### 错误诊断
- **高德错误码翻译**：把 `10009 / 10012 / 10024 / 20800 / 21002` 等翻译成中文友好提示 + 修复建议。
- **网络重试**：所有高德 Web 服务请求统一走 `fetchAmap()`，7s 超时 + 1 次自动重试。
- **多路反馈**：错误时左侧面板红色面板 + 屏幕中央 toast 双重展示，便于不同设备查看。

---

## 在线预览

待补充。建议在 [Vercel](https://vercel.com/) 部署后填入。

---

## 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript 5 |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui |
| 图表 | 自实现 SVG 海拔剖面（无 Recharts 依赖） |
| 地图 | 高德 JS API v2（`@amap/amap-jsapi-loader`） |
| 通知 | Sonner |
| 拖拽 | 原生 HTML5 Drag & Drop |
| 包管理器 | pnpm |
| 测试 | _尚未集成_ |

---

## 快速开始

### 前置要求

- Node.js ≥ 18.18
- pnpm ≥ 8（推荐）或 npm / yarn / bun
- 高德开放平台账号 [https://console.amap.com](https://console.amap.com)

### 安装

```bash
git clone <your-repo-url>
cd <project-dir>
pnpm install
```

### 环境变量

仓库根目录提供 [`.env.example`](./.env.example) 作为模板，复制一份并填入自己的 Key：

```bash
cp .env.example .env.local
# 然后编辑 .env.local 填入下面三把 Key
```

| 变量 | 用途 | 是否暴露浏览器 |
|---|---|---|
| `NEXT_PUBLIC_AMAP_KEY` | JS API Key，地图渲染 / 定位 | 是（必须 `NEXT_PUBLIC_` 前缀） |
| `NEXT_PUBLIC_AMAP_SECURITY_CODE` | JS API 安全密钥 | 是 |
| `AMAP_WEB_KEY` | Web 服务 Key，仅服务端 Route Handler 使用 | 否 |

> 三者**必须分别申请**，不可混用。`.env.local` 已在 `.gitignore` 中，不会被提交。

部署到 Vercel 时，在 **Project Settings → Environment Variables** 添加同名三项即可。

### 运行

```bash
# 开发
pnpm dev

# 生产构建
pnpm build
pnpm start

# 类型检查
pnpm exec tsc --noEmit
```

打开 [http://localhost:3000](http://localhost:3000) 即可看到工作台。

---

## 高德 Key 申请与配置

### 1. 创建 JS API Key（前端用）

1. 登录 [高德开放平台](https://console.amap.com)。
2. 「应用管理 → 我的应用 → 创建新应用」，填写应用名。
3. 「添加 Key」→ 服务平台选 **「Web 端 (JS API)」**。
4. **域名白名单**填入：
   - 本地开发：`localhost`
   - 部署域名：如 `your-app.vercel.app`、自定义域名
5. **务必开启「设置安全密钥(securityJsCode)」**，记下 Key 与 securityJsCode 分别填入 `NEXT_PUBLIC_AMAP_KEY` 和 `NEXT_PUBLIC_AMAP_SECURITY_CODE`。

### 2. 创建 Web 服务 Key（后端用）

1. 同一应用下「添加 Key」→ 服务平台选 **「Web 服务」**（不是 Web 端）。
2. 在服务列表中**勾选**：
   - 路径规划 V5
   - 地理 / 逆地理编码
   - 输入提示
3. 复制 Key 填入 `AMAP_WEB_KEY`。

> 没勾选服务会出现 `errcode: 10012 NOT_HAVE_PERMISSION`；详见 [常见问题](#常见问题)。

---

## 项目结构

```
.
├── app/                        # Next.js App Router 入口
│   ├── api/
│   │   ├── amap/search/        # 高德搜索代理（输入提示 + 关键字检索兜底）
│   │   ├── amap/regeo/         # 逆地理编码代理
│   │   └── route/plan/         # 骑行路径规划代理（多段串行）
│   ├── layout.tsx
│   ├── page.tsx                # 桌面 / 移动布局分发
│   └── globals.css
├── components/
│   ├── route-planner/
│   │   ├── amap-view.tsx       # 真实高德地图组件（含 hotspotclick / GPS / 拉起导航）
│   │   ├── left-panel.tsx      # 桌面左侧面板（响应式宽度）
│   │   ├── mobile-layout.tsx   # 移动端布局（标题渐隐 + 工作区滚动）
│   │   ├── search-section.tsx  # 地点搜索（浮层结果 + 二次过滤）
│   │   ├── waypoint-list.tsx   # 点位管理（拖拽 / 批量 / 过滤）
│   │   ├── route-actions.tsx   # 规划 / 全览 / 清空 + 错误展示
│   │   ├── route-stats.tsx     # 距离 / 用时 / 爬升等统计
│   │   ├── elevation-profile.tsx # 海拔剖面（SVG + 触摸支持）
│   │   ├── map-toolbar.tsx     # 图层切换 / 拉起导航 / 重载 / 缩放 / 定位
│   │   └── bottom-toolbar.tsx  # 导入 / 导出
│   └── ui/                     # shadcn/ui 基础组件
├── hooks/
│   ├── use-route-planner.ts    # 路线状态管理 hook
│   └── use-mobile.ts
├── lib/
│   ├── coord.ts                # WGS84 → GCJ02 坐标转换
│   ├── elevation.ts            # 本地海拔估算
│   ├── fetch-amap.ts           # 高德 Web 服务请求重试封装
│   ├── import-route.ts         # GPX / TCX / KML / CSV 解析
│   ├── launch-nav.ts           # 移动端拉起高德 App 智能分发
│   └── route-utils.ts
├── services/
│   ├── amap.ts                 # 搜索 / 反查（前端 → /api 代理）
│   └── route.ts                # 路径规划 / 海拔（前端 → /api 代理）
├── types/route.ts              # Waypoint / RoutePlanResult / AmapPOI 等
└── DEPLOYMENT.md               # 详细变更日志（v1.0 ~ v1.18）
```

---

## 使用指南

1. **添加点位**：左侧搜索框输入关键词 → 选中候选；或直接点击地图任意位置 → 弹卡确认。
2. **调整顺序**：点位管理列表中拖拽排序，第一个自动为「起点」、最后一个为「终点」、中间为「途经点」。
3. **规划路线**：点击「规划骑行路线」→ 地图自动绘制蓝色折线 + 自动全览。
4. **查看海拔**：底部「海拔剖面」展开，hover/touch 查看任意位置的距离与海拔。
5. **拉起导航**（移动端）：点击地图右上「拉起导航」→ 自动唤起高德 App 骑行导航；未安装跳 Web 版。
6. **导入文件**：底栏「导入」→ 选 GPX / TCX / KML / CSV → 自动批量加点。

---

## 部署

### Vercel（推荐）

1. 将仓库推送到 GitHub。
2. [https://vercel.com/new](https://vercel.com/new) 导入项目。
3. **Settings → Environment Variables** 添加三个 Key：
   - `NEXT_PUBLIC_AMAP_KEY`
   - `NEXT_PUBLIC_AMAP_SECURITY_CODE`
   - `AMAP_WEB_KEY`
4. **将 Vercel 分配的域名（含 `*.vercel.app` 与 preview）加入高德 JS API Key 域名白名单**。
5. 部署。

### 自部署

```bash
pnpm build
pnpm start
```

需保证生产环境注入了上述三个环境变量。

---

## 常见问题

### 1. 地图加载失败 / `INVALID_USER_DOMAIN`

- 高德 JS API Key 没有把当前域名加入白名单。在控制台「Key → 编辑 → 域名白名单」添加：
  - `localhost`（开发）
  - `*.vercel.app` 与自定义域名（生产）
- 保存后等 1-2 分钟生效。

### 2. 路线规划报 `have no permission` / `errcode: 10012` / `21002`

- `10012 / 10024`：`AMAP_WEB_KEY` 没勾选「路径规划 V5」服务，到控制台开启。
- `10009`：Key 类型不对，必须是「Web 服务」类型 Key（不是 JS API Key）。
- `21002`：早期把 `waypoints` 拼到骑行 API 上引起，现版本已改为多段串行，不应再出现。

### 3. 偶发 `500 ETIMEDOUT`

sandbox 出口偶发网络抖动。`fetchAmap()` 已加 7s 超时 + 1 次自动重试，仍失败时返回友好的"网络抖动，请稍后重试"。

### 4. 移动端拉不起高德 App 骑行模式

- 高德 App 版本需 ≥ 9.x 才能识别 `t=3`。
- 微信内置浏览器对自定义 scheme 限制严格，无法唤起；需「右上角→在浏览器打开」后再试。
- v0 / 沙箱预览的 iframe 跨域会拦截 `location.href = "iosamap://..."`，请用真机直接打开页面验证。

### 5. 导入 GPX 后点位偏移几十米

GPX 文件存的是 WGS-84 坐标，高德地图是 GCJ-02。本工具会自动调用 `wgs84ToGcj02` 转换；如果你看到偏移，请确认导入路径用的是 `lib/import-route.ts` 而非自行写的解析。

更多详情见 [`DEPLOYMENT.md`](./DEPLOYMENT.md) 的完整变更日志（v1.0 → v1.18）。

---

## 路线图

- [ ] 路线分享（短链 / 二维码）
- [ ] 真实地形 DEM 海拔（替换本地估算）
- [ ] 多平台导航选择抽屉（高德 / 百度 / 腾讯）
- [ ] 用户账户与云端路线同步
- [ ] PWA 支持，离线查看历史路线
- [ ] 单元测试 / E2E 测试
- [ ] i18n（英文 / 繁体）

---

## 贡献指南

欢迎提 Issue 与 PR。建议流程：

1. Fork 仓库并 clone 到本地。
2. 新建分支 `git checkout -b feat/xxx`。
3. 提交前确认 `pnpm exec tsc --noEmit` 类型检查通过。
4. 提交信息建议遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：`feat:` / `fix:` / `docs:` / `refactor:` / `chore:` 等。
5. 提 PR，描述清楚变更点与测试方法。

---

## 许可证

[MIT](./LICENSE) © 2026 Cycling Route Planner Contributors

---

## 致谢

- [高德开放平台](https://lbs.amap.com/)：地图 JS API 与 Web 服务 API
- [Next.js](https://nextjs.org/) / [React](https://react.dev/) / [Tailwind CSS](https://tailwindcss.com/) / [shadcn/ui](https://ui.shadcn.com/)
- [Sonner](https://sonner.emilkowal.ski/) toast 通知库
- 所有 Issue 与 PR 贡献者
