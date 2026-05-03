# 骑行路书制作 · 部署与接入文档

> 本文档随每次"会影响接入/部署"的代码改动同步更新。

---

## 变更日志

### 2026-05-02 · 路线规划错误诊断 + 高德错误码翻译（v1.5）

**问题**：用户反馈"有时候规划路线时会出现 have no permission 错误"。原实现只把 `errmsg` 透传给前端，用户看不到具体错误码也不知道该怎么修。

**根因**：`have no permission`（高德 errcode `10009 / 10012 / 10024`）几乎都是 **AMAP_WEB_KEY 在高德控制台没勾选「路径规划」服务**。还有以下情况会出错但提示混淆：

| errcode | errmsg | 真实原因 | 修复方法 |
|---|---|---|---|
| 10001 | INVALID_USER_KEY | Key 不存在 | 重新创建 |
| 10003 | DAILY_QUERY_OVER_LIMIT | 个人 5000 次/日额度用完 | 等次日 0 点，或升级配额 |
| 10004 | ACCESS_TOO_FREQUENT | QPS 超限（个人 50/秒）| 节流后重试 |
| 10005/10010 | INVALID_USER_IP | IP 白名单限制 | 关闭白名单或加入服务器 IP |
| **10009** | USERKEY_PLAT_NOMATCH | Key 类型不匹配 | 用「Web 服务」类型 Key（不是 JS API Key） |
| **10012/10024** | NOT_HAVE_PERMISSION | Key 未开通『路径规划』 | 控制台 → 编辑服务 → 勾选『路径规划』 |
| 20800 | OUT_OF_SERVICE | 起终点不在骑行服务范围 | 选国内主干道，避免郊区/海外 |
| 20801 | NO_ROADS_NEARBY | 附近无可骑行道路 | 把点位拖到正规道路上 |
| 20803 | OVER_DIRECTION_RANGE | 单段距离 > 500km | 拆成多段规划 |

**修复**：
- `app/api/route/plan/route.ts` 新增 `explainAmapError(code, info)` 把高德错误码翻译成中文 `{ title, hint }`，5xx 时返回 `{ error, hint, code, rawMessage }`，并优先按 `status === "1"` 判定业务成功。
- `services/route.ts` 把 `hint` / `code` 挂到 `Error` 实例上往外传。
- `hooks/use-route-planner.ts` 把 `planError` 从 `string` 升级为 `{ message, hint?, code? }`。
- `components/route-planner/route-actions.tsx` 错误展示改为图标 + 标题 + 修复建议两段式，错误码 monospace 小字显示。
- `components/route-planner/left-panel.tsx` 同步类型定义。
- `app/page.tsx` 新增 `useEffect` 监听 `planError`，弹 8 秒 `toast.error({ description: hint })`，让用户在屏幕中央也能看到。

**用户操作流程（出现 NOT_HAVE_PERMISSION 时）**：
1. 打开 [高德控制台 → 应用管理](https://console.amap.com/dev/key/app)。
2. 找到对应的 `AMAP_WEB_KEY`（注意不是前端 JS API Key）。
3. 点「编辑」→ 服务平台勾选 `Web 服务`。
4. 在服务列表中**勾选『路径规划 V5』和『地理/逆地理编码』**（很多人忘记勾这两个）。
5. 保存，1-2 分钟生效，刷新页面重试。

---

### 2026-05-02 · 底图原生 POI 一键加入路线（v1.4）

**能力**：
- 直接点击高德底图自带的 POI 标签（公园、学校、地铁站、景区、商场、建筑等）即可弹出信息卡，一键加入路线。
- 信息卡内容：POI 名称（来自 `hotspotclick` 事件）+ 城市/区县 + 详细地址（异步反查）+ 经纬度 + 「+ 添加到路线」按钮。
- 不影响原有"地图选点"模式：空白区域点击仍走 `click` 事件，只在选点模式生效。

**实现要点**：
- 高德 JS API v2 提供 `map.on("hotspotclick", ...)` 事件，事件对象包含 `name` / `id` / `lnglat`。
- `new AMap.Map(...)` 选项加 `isHotspot: true` + `showLabel: true` 启用底图热点交互。
- `new AMap.InfoWindow({ isCustom: true })` 用纯 DOM 自定义弹窗（包含 hover 状态的按钮），避免高德默认气泡的样式包袱。
- 第一帧立刻用 hotspot 自带的 `name + lnglat` 渲染弹窗（地址显示「加载中…」），同时调用 `/api/amap/regeo` 异步补全地址，`infoWindow.setContent()` 局部刷新；用户感知零延迟。
- `onPickPoint` 用 ref 持有，避免重新初始化地图（`mapRef` 仅初始化一次，依赖只跟 jsKey/securityCode 有关）。

**文件变更**：
- `components/route-planner/amap-view.tsx`：
  - 类型 `AMapInstance.on` 改为重载形式，分别为 `click` / `hotspotclick` / 通用 `string` 提供精确事件类型。
  - 新增 `AMapInfoWindowInstance` 与 `AMapNS.InfoWindow`。
  - 新增工具函数 `createPoiPopup(opts)` 返回原生 `HTMLElement`，按钮通过 `addEventListener` 绑定，无需依赖全局函数。
  - 新增 `onPickPointRef` 与 `infoWindowRef`。

---

### 2026-05-02 · 左侧面板响应式布局 + 双重过滤搜索（v1.3）

**问题**：
1. 左侧固定 380px，在小屏（< 1280px）时挤压地图视野；大屏（> 1920px）又显得过窄。
2. 整个左侧用一个外层 `ScrollArea` 滚动，搜索结果一旦变多，会把"点位管理"挤到屏幕外，体验差。
3. 当点位数量超过 ~10 个时缺乏快速定位的方式。

**修复**：
- `components/route-planner/left-panel.tsx`：
  - **响应式宽度**：`w-[280px] sm:w-[320px] md:w-[360px] xl:w-[400px] 2xl:w-[440px]`，按设备自适应。
  - **垂直布局重构**：去掉外层 `ScrollArea`，改成五段式 flex 布局——header 固定 → 地点搜索固定 → **点位管理 `flex-1 min-h-0`（弹性主区，独立滚动）** → 路线操作+统计 `max-h-[38vh]` 独立滚动 → 底部工具栏固定。这样搜索结果不会再挤压点位列表。
- `components/route-planner/waypoint-list.tsx`：
  - 内部三段式 flex（标题+过滤框 → 列表区 `flex-1 overflow-y-auto` → 起终预览固定底部）。
  - 新增**点位过滤搜索框**：按名称 / 地址 / 城市 / 城区匹配，状态栏显示 `共 N 个 / 筛 M`。
  - 过滤状态下禁用拖拽排序（避免索引错位）。
- `components/route-planner/search-section.tsx`：
  - 搜索结果新增**二次过滤框**（带过滤图标），可在大量结果中快速筛选。
  - 结果列表 `max-h-[32vh]` 让出空间给点位管理。
  - 经纬度精度从 5 位降到 4 位以适配窄屏。

**响应式断点表**：

| 视口宽度 | 左侧面板宽度 | 适用设备 |
|---------|------------|---------|
| < 640px   | 280px | 手机横屏 / 小平板 |
| 640-768   | 320px | 平板 |
| 768-1280  | 360px | 笔记本 |
| 1280-1536 | 400px | 桌面 |
| ≥ 1536    | 440px | 大屏桌面 |

---

### 2026-05-02 · 修复地图容器尺寸 0×0（v1.2）

**现象**：日志显示 `[v0] AMap JS API 加载成功，创建地图实例` 一切正常，状态切换为 `ready`，但用户看到的右侧地图区域**完全空白**（瓦片不渲染）。

**根因**：高德 `new AMap.Map(container, ...)` 创建时如果 `container` 的 `clientWidth` / `clientHeight` 为 0，瓦片无法计算视口范围，**地图实例正常创建但什么都不画**。

之前的容器层级 `flex-1 flex flex-col overflow-hidden` + 子级 `absolute inset-0`，在某些 flex 链路（缺 `min-h-0` / `min-w-0`）下，绝对定位子元素会被压缩到 0×0。

**修复**：
- `components/route-planner/amap-view.tsx`：
  - 根 div 改为 `relative flex-1 min-w-0 min-h-0 h-full overflow-hidden bg-muted`，确保整体撑满。
  - 容器 div 同时设置 `absolute inset-0` 与内联 `style={{ width: "100%", height: "100%" }}` 双保险。
  - `new AMap.Map` 之前打印 `containerRef.current.clientWidth/Height`，便于排查。
  - `AMap.Map` 选项加 `resizeEnable: true`，容器尺寸变化时自动重新计算。
- `app/page.tsx`：dynamic loading 占位 div 也加 `h-full min-w-0`，防止过渡期 layout 抖动。

**验证方法**：浏览器 DevTools Console 应能看到 `[v0] AMap JS API 加载成功，容器尺寸= XXX x YYY`，两个数字都应远大于 0。如果仍为 0，说明上层布局还在压缩——通常是 `<main>` 缺少 `h-screen` 或 flex 链路某层缺 `min-h-0`。

---

### 2026-05-02 · 修复 SSR 报错 + 增强错误诊断（v1.1）

**问题**：
1. 客户端首次访问报错 `ReferenceError: window is not defined` —— 因 `@amap/amap-jsapi-loader` 在模块顶层引用了 `window`，被 Next.js SSR 阶段执行时炸掉。
2. 用户反馈"地图没有正常加载出来"，但页面只显示一行小字提示，看不到具体原因。

**修复**：
- `app/page.tsx`：使用 `next/dynamic({ ssr: false })` 包装 `AMapView`，地图组件只在浏览器端渲染。
- `components/route-planner/amap-view.tsx`：
  - 把 `import AMapLoader from "@amap/amap-jsapi-loader"` 改为 `useEffect` 内的动态 `import()`，进一步消除 SSR 路径上的副作用。
  - 加载阶段打印 `console.log("[v0] AMap init …")` 调试信息（含 host 与 key 前缀）。
  - 错误捕获识别常见错误码：`USERKEY_PLAT_NOMATCH` / `INVALID_USER_DOMAIN` / `InvalidUserScode` / `DAILY_QUERY_OVER_LIMIT`，给出中文友好提示。
  - 错误状态全屏遮罩，列出 5 步排查清单（含当前 `window.location.host`，方便复制到高德白名单）。

**重要：高德 Key 白名单配置**

如果你看到错误面板，最常见的原因是 **当前预览域名未在高德控制台 Key 白名单中**。请：

1. 打开 [高德控制台 - 应用管理](https://console.amap.com/dev/key/app)
2. 找到对应的 Key（与 `NEXT_PUBLIC_AMAP_KEY` 一致）
3. 确认 Key 类型为「**Web端(JS API)**」（不是 Web 服务）
4. 在「**域名白名单**」中添加 v0 预览域名通配，如 `*.vusercontent.net` 与你自己的部署域名（如 `*.vercel.app`、自定义域名）
5. 保存后等 1-2 分钟全网生效，刷新页面

> 若 Key 创建时勾选了「设置安全密钥(securityJsCode)」，必须与 `NEXT_PUBLIC_AMAP_SECURITY_CODE` 一致；该方案会把 securityJsCode 暴露在浏览器，仅适合**开发环境**。生产环境推荐用代理方案（见下方"生产强化"章节，待补充）。

---

### 2026-05-02 · 接入真实高德 API（v1.0）

**已完成**：项目已从 mock 模式切换到真实高德 API，可直接使用。

- 新增依赖：`@amap/amap-jsapi-loader@^1.0.1`
- 新增服务端代理路由（保护 Web 服务 Key，仅服务端读取 `AMAP_WEB_KEY`）：
  - `app/api/amap/search/route.ts` —— POI 搜索（输入提示 + 关键字检索兜底）
  - `app/api/amap/regeo/route.ts` —— 逆地理编码（地图点选反查地址）
  - `app/api/route/plan/route.ts` —— 骑行路径规划（v5 `direction/bicycling`）
- 新增组件：`components/route-planner/amap-view.tsx`
  - 基于高德 JS API v2 的真实地图组件
  - 图层切换：标准 / 卫星+路网 / 浅色地形 / 骑行+实时路况
  - 支持地图点选添加点位（`reverse-geocode` 后 `addWaypoint`）
  - 自动 `setFitView`，Marker 按 `start / via / end` 角色着色，Polyline 显示行驶方向
- 新增工具：`lib/elevation.ts` —— 本地海拔估算（高德 Web 服务无公开 DEM 接口）
- 路由规划返回值在服务端补充 `ascent / descent / maxGrade`
- 移除 mock：`lib/mock/*` 与旧 SVG 假地图 `components/route-planner/map-view.tsx`
- 服务层 `services/amap.ts` / `services/route.ts` 移除 `USE_REAL_API` 开关，全部走真实 API。

---

## 当前状态

| 项目 | 状态 |
|------|------|
| 地图渲染 | 真实高德 JS API |
| 地点搜索 | 真实高德 Web API（输入提示 + 关键字检索） |
| 骑行路径规划 | 真实高德 Web API v5 |
| 逆地理（点选地图） | 真实高德 Web API |
| 海拔剖面 | **本地估算**（高德未开放 DEM 接口，可后续替换） |
| GPX/TCX/KML 导出 | 占位（按钮已就绪，待 `services/export.ts`） |
| 拉起高德导航 | 占位（按钮已就绪，待对接 URI API） |

---

## 架构

```
浏览器
 ├─► /api/amap/search       ─► restapi.amap.com/v3/assistant/inputtips
 │                              + /v3/place/text（兜底）
 ├─► /api/amap/regeo        ─► restapi.amap.com/v3/geocode/regeo
 ├─► /api/route/plan        ─► restapi.amap.com/v5/direction/bicycling
 └─► AMapLoader (JS API)    ─► webapi.amap.com/maps?key=NEXT_PUBLIC_AMAP_KEY
```

- **浏览器侧**：仅持有 `NEXT_PUBLIC_AMAP_KEY` + `NEXT_PUBLIC_AMAP_SECURITY_CODE`，用于地图渲染、覆盖物绘制。
- **服务端侧**：`AMAP_WEB_KEY` 仅在 Route Handler 中读取，永不下发到浏览器。
- 所有数据格式严格对齐 `types/route.ts`，前端组件不感知具体接口实现。

---

## 必需环境变量

| 变量 | 用途 | 暴露给浏览器 |
|------|------|--------------|
| `NEXT_PUBLIC_AMAP_KEY` | 高德 JS API（地图渲染） | 是 |
| `NEXT_PUBLIC_AMAP_SECURITY_CODE` | JS API 安全密钥（高德新版强制） | 是 |
| `AMAP_WEB_KEY` | 高德 Web 服务（搜索 / 路径 / 逆地理） | **否** |

> 当前项目已通过 v0 设置注入。生产部署到 Vercel 时需在 Project → Settings → Environment Variables 重新填写。

---

## 高德控制台配置

1. 登录 [console.amap.com](https://console.amap.com/)。
2. 创建两类应用：
   - **Web 端（JS API）**：申请 JS API Key + 安全密钥，在"域名白名单"中添加：
     - 开发：`localhost`
     - 预览：`*.vusercontent.net`、`*.vercel.app`
     - 生产：你的自定义域名
   - **Web 服务**：申请 Web 服务 Key��建议设置 referer/IP 白名单防盗刷）。
3. 确保已开通：
   - JS API：基础地图、卫星图、路况图
   - Web 服务：地点搜索（关键字 + 输入提示）、地理/逆地理编码、**骑行路径规划 v5**

---

## 接口契约

### 1. POI 搜索
```
GET /api/amap/search?keywords=西湖&city=杭州&pageSize=15
→ { pois: AmapPOI[] }
```

### 2. 逆地理（地图点选）
```
GET /api/amap/regeo?location=120.155,30.274
→ AmapPOI
```

### 3. 骑行路径规划
```
POST /api/route/plan
body: { origin: "lng,lat", destination: "lng,lat", waypoints: ["lng,lat", ...] }
→ RoutePlanResult { distance, duration, path, steps, ascent?, descent?, maxGrade? }
```

> 高德 v5 骑行规划单次最多 **16 个途经点**，服务端会自动截断。

---

## 海拔数据

高德 Web 服务**未公开 DEM 高程查询接口**。当前实现 `lib/elevation.ts` 使用基于经纬度种子的多周期正弦合成，
仅生成**演示用**的平滑曲线。`services/route.ts` 据此估算累计爬升/下降/最大坡度。

切换到真实 DEM 时，仅需替换 `estimateElevationProfile()`：

- [OpenTopoData](https://www.opentopodata.org/)（免费，SRTM 30m）
- 自建 SRTM/ASTER GDEM 服务
- Mapbox Tilequery + terrain-rgb

接口签名 `fetchElevationProfile(path: LngLat[]) -> ElevationPoint[]` 保持稳定��调用方代码无需改动。

---

## 本地启动

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000` 即可。

---

## 部署到 Vercel

1. Push 到 GitHub。
2. 在 Vercel Import 项目。
3. 在 Project Settings → Environment Variables 添加上方三个变量。
4. 在高德控制台域名白名单中加入 Vercel 部署域名。
5. Deploy。

---

## 后续路线图

- [ ] **GPX / TCX / KML / CSV 导出**：在 `services/export.ts` 中实现，从 `RoutePlanResult.path` + `ElevationPoint[]` 序列化。
- [ ] **拉起高德导航**：对接 [URI API](https://lbs.amap.com/api/uri-api/guide/travel/route) `https://uri.amap.com/navigation?...&mode=ride`。
- [ ] **撤销/重做**：基于 `waypoints` 的 history stack。
- [ ] **路径简化**：长距离骑行 `path` 可达数千点，绘制前可用 simplify-js 简化到 ≤500 点。
- [ ] **后端缓存**：搜索结果以 `amap:search:{kw}:{city}` 为 key 加 Redis 缓存。
- [ ] **真实海拔**：替换 `lib/elevation.ts` 实现。
- [ ] **数字签名**：若高德控制台启用 SK，服务端补充 `sig=md5(sortedQuery + AMAP_WEB_SECRET)`。
