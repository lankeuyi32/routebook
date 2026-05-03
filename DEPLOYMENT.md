# 骑行路书制作 · 部署与接入文档

> 本文档随每次"会影响接入/部署"的代码改动同步更新。

---

## 变更日志

### 2026-05-03 · 代码审阅 — 修复闭包陷阱 / 视野跳变 / 死代码等（v1.18）

系统性审阅后发现并修复一组用户操作逻辑与代码问题：

**A. 真正的 Bug**
- **A1 闭包陷阱**：`app/page.tsx` 的 `handleReload` 在 `await planner.planRoute()` 后读 `planner.planError`，这是闭包旧值，永远是 `null`，导致**失败时也提示"路线已重新规划"**。
  - 修复：`useRoutePlanner.planRoute` 返回 `Promise<{ ok: true } | { ok: false; error }>`，调用方据此判断成败。
- **A2 marker 冒泡**：`amap-view.tsx` marker `bubble: true`，点击已有点位会冒泡到 `map.click`，再次弹出"添加到路线"卡（虽被 `addWaypoint` 内 dedup 拦下，但 UX 困惑）。
  - 修复：marker `bubble: false`。

**B. 死代码 / Lint 噪音**
- `components/route-planner/map-toolbar.tsx`：`import { useState }` 未使用 → 删除。
- `components/route-planner/mobile-layout.tsx`：`scrollRef` 仅 write 不 read → 删除 ref 与 import。
- `lib/launch-nav.ts`：`fallbackToWeb` 内的 `if (Date.now() - startTs < 800) return` 不可达分支（外层 1.6s setTimeout 已经远 > 800） → 简化为内联逻辑，直接判 `document.hidden`。
- `hooks/use-route-planner.ts`：`addWaypoint` 中按 `prev.length` 分配 `start` / `end` 是死代码（`decoratedWaypoints` useMemo 总会按索引重置） → 统一填 `via` 并加注释。

**C. UX 改进**
- **C1 视野跳变**：`amap-view.tsx` 中每次 `waypoints` 数组引用变化（包括拖拽排序、删除、改名）都 `setFitView`，用户调好的视野被强制全览。
  - 修复：新增 `prevWaypointCountRef`，**仅在点位数量变化**（增 / 删 / 导入）时 fitView；拖拽排序、改名不再扰乱视野。
- **C2 海拔剖面 touch 支持**：`elevation-profile.tsx` 仅有 mouse 事件，移动端用户无法看到海拔/距离数值。
  - 修复：抽出 `pickIndexByClientX(svg, clientX)` 复用，新增 `onTouchStart` / `onTouchMove` / `onTouchEnd`；svg 加 `touch-none` 禁止页面滚动干扰。
- **C4 清空确认**：`app/page.tsx` 新增 `handleClear`，点位 ≥ 1 时用 `window.confirm` 防误点丢失全部点位；空状态下直接清空。

**已知未修（低优先级）**
- D1/D2 设计 token 偏离：`waypoint-list.tsx` 批量删除按钮、`route-stats.tsx` 升降颜色硬编码 Tailwind 颜色（与 destructive token 不统一）。视觉上无功能影响。
- A3 `isMobile` 切换时地图重建：跨断点切换会触发 JSAPI 重新加载（用户主动断点切换频率低，未优化）。

---

### 2026-05-03 · 移除地图顶部「在地图上添加点位」按钮（v1.17）

**变更**：删除地图顶部居中的「在地图上添加点位 / 请在地图上点选位置」切换按钮。

**原因**：v1.11 起，地图任意位置（POI / 空白）单击都会弹出统一信息卡，用户点「+ 添加到路线」即可加入；此按钮代表的"选点模式"（直接点直接加、不弹卡）已与默认行为重复，反而让 UI 变得啰嗦。

**清理范围**（`components/route-planner/amap-view.tsx`）：
- 删除按钮 JSX（顶部居中浮层）。
- 删除 `pickMode` / `setPickMode` 与 `pickModeRef`、对应的 useState 与 useEffect 同步。
- 简化 `map.on("click")` handler：移除「模式 A：选点模式」分支，统一走弹卡确认流程。
- 移除已不使用的 `Plus` 图标与 `Button` 组件 import。

**功能保留**：地图任意位置单击 → 弹卡 → 确认加点；底图自带 POI 标签的 hotspotclick 流程不变。

---

### 2026-05-03 · 移动端专属布局：标题→地图→工作区，滚动时标题渐隐（v1.16）

**需求**：手机端把地图放在「骑行路书制作」标题与「地点搜索」之间，向下滑动时标题渐隐，各模块布局合理且功能不丢失。

**实现**：
- 新增 `components/route-planner/mobile-layout.tsx`，移动端（< 768px）专用布局；桌面端继续走 `LeftPanel` 不变。
- `app/page.tsx`：用 `useIsMobile()` 分支渲染。地图节点 `mapNode` 在父级实例化一次，作为 prop 传给 `MobileLayout`，避免桌面/移动各自挂一次 JS API loader。
- 移动布局结构（`flex flex-col h-screen`，外层不滚动）：
  1. **顶部标题** — sticky，`max-h-16 → max-h-0` + `opacity-1 → opacity-0` + `-translate-y-1` 200ms 缓动；`scrollTop > 24` 触发隐藏，回滚到顶部恢复。
  2. **地图区** — `h-[38vh] min-h-[240px] max-h-[420px]`，固定高度避免被工作区挤压；地图自带的 zoom / layer / 拉起导航等控件不受影响。
  3. **工作区** — `flex-1 min-h-0 overflow-y-auto overscroll-contain` 整体可滚动，标题渐隐由其 `onScroll` 触发：
     - **地点搜索** sticky 置顶（`sticky top-0 z-20 bg-card`），搜索结果浮层 `absolute top-full` 仍正常铺开
     - **点位管理** 不限高、不内部滚动，跟随外层滚动（拖拽排序、批量删除、过滤搜索全部正常）
     - **路线操作 + 路线统计** 紧随其后，默认全部显示
     - 末尾 `h-14` 留白避免被底部工具栏遮挡
  4. **底部工具栏** `shrink-0` 粘底，导入/导出按钮一直可达。

**功能保留确认**：
- 所有按钮、拖拽、批量、过滤、地图交互、拉起导航、定位、图层切换 = 0 改动
- 桌面端 ≥ 768px 完全不受影响
- 地图实例**单例**（避免双倍 JSAPI 加载与定位/反查重复请求）

**注意**：`useIsMobile` 客户端 hook，SSR 阶段默认 `false`（桌面优先）；移动设备水合后会切换一次布局，符合 Next.js 默认行为。

---

### 2026-05-03 · 移动端拉起高德 App 骑行导航（智能分发 + 兜底）（v1.15）

**问题**：之前仅用 `https://uri.amap.com/navigation?mode=ride` 拉起，移动端唤起高德 App 时**骑行模式识别率低**——iOS 几乎无效，Android 部分版本退化为驾车。原因是 `mode=ride` 在 Web URI 协议里对 App 的支持本就不完整。

**修复**：新增智能分发器 `lib/launch-nav.ts`，按平台选最优 URL，并对 App 未安装做静默兜底。

- **平台嗅探** `detectPlatform()` → `ios` / `android` / `wechat` / `desktop`
- **iOS** → `iosamap://path?...&t=3&dev=0`
- **Android** → `amapuri://route/plan?...&t=3&dev=0`
- **桌面 / 微信内置** → 直接新标签 `https://uri.amap.com/navigation?mode=ride&...`（微信对自定义 scheme 限制严格，不试 App）
- **未安装兜底**：移动端先 `location.href = scheme` 试图唤起 App，监听 `visibilitychange` 检测页面是否被切走（≈ App 起来了）；1.6 秒内仍可见则自动 `window.open(webUri)`。
- 参数 `t=3`（高德 App 内：0=驾车 1=公交 2=步行 **3=骑行** 4=货车）；`dev=0` 表示坐标已经是 GCJ-02（与我们的数据一致，不需再偏移）。

**用户反馈**：
- iOS / Android：toast「正在唤起高德骑行导航 · 若未自动唤起 App，会在 1.6 秒后跳转网页版」
- 微信：toast「微信内已打开网页骑行导航 · 如需 App 内导航，请右上角选择『在浏览器打开』」
- 桌面：toast「已在新标签打开高德骑行导航」
- 多点路线（>2 点）：附带「仅使用起点与终点（高德骑行不支持途经点）」说明

**已知局限**：
- 高德 App 的 `t=3` 参数生效需要 App 版本 ≥ 9.x，老版本可能仍退化为驾车。
- 微信内置浏览器对自定义 scheme 限制严格，无法唤起 App，只能跳 H5；可引导用户「右上角…→ 在浏览器打开」后再点。
- 跨域沙箱（包括 v0 预览的 iframe）里 `location.href = "iosamap://..."` 不会真的拉起 App，需在真机直接打开页面测试。

---

### 2026-05-03 · 「重载」改为重新规划路线（v1.14）

**问题**：v1.13 把「重载」实现成 `setFitView`(地图全览)，但地图通常已经处于全览状态，点击按钮**视野不变 = 看上去没反应**。

**修复**：把「重载」语义升级为更有意义的「**重新发起路线规划**」（用户改了点位顺序、上次规划失败重试等都是高频诉求），并保留地图全览作为兜底。

- `components/route-planner/amap-view.tsx`：
  - `Props` 新增 `onReload?: () => void`，由父组件接路线重新规划逻辑。
  - `handleReload()` 优先调用 `onReload`，未传时才走原来的 `setFitView` 全览（并加 `toast.message("视野已重置")` 让按钮总是有可见反馈）。
- `app/page.tsx`：
  - 新增 `handleReload()`：
    - 正在规划中 → toast 提示，避免重复触发。
    - 点位 < 2 → toast 报错 + 触发地图全览作为兜底反馈。
    - 否则 `await planner.planRoute()` + `toast.loading → success/error` 全流程反馈。
  - `<AMapView />` 新增 `onReload={handleReload}` prop。

**用户体验**：点击「重载」按钮无论何种状态都有明确视觉反馈（loading toast → 成功/失败 toast / 视野动画）。重新规划成功时地图会自动 fit view 到新路线，直观可见。

---

### 2026-05-03 · 修复「拉起导航」与「重载」按钮无响应（v1.13）

**问题**：地图右上角的「拉起导航」蓝色按钮和「重载」按钮点击没反应。

**根因**：`<MapTopToolbar layer={layer} onLayerChange={setLayer} />` 调用时只传了 `layer` / `onLayerChange` 两个 prop，而 `MapTopToolbar` 内部的拉起导航 / 重载按钮分别绑定到 `onLaunchNav` / `onReload`，未传时 `onClick={undefined}` 自然没反应。这俩回调一直是占位空槽位，对应的处理函数从来没在 `AMapView` 里实现过。

**修复**：在 `components/route-planner/amap-view.tsx` 内实现并传入两个回调。

- **`handleLaunchNav()`** —— 拉起高德骑行导航
  - 校验：至少 2 个点位才能拉起，否则 `toast.error`。
  - 拼接高德 URI API：`https://uri.amap.com/navigation?from={lng,lat,name}&to={lng,lat,name}&mode=ride&coordinate=gaode&callnative=1&src=route-planner`。
  - `window.open(url, "_blank")` 在新标签打开（移动端 `callnative=1` 会优先唤起高德 App，未安装回落 Web 版）。
  - 弹窗被拦截时 toast 报错。
  - **限制说明**：高德 URI API 的骑行模式（`mode=ride`）官方不支持途经点参数，多点路线只能取「起→终」两端；当 `waypoints.length > 2` 时会 toast 提示用户该限制。
- **`handleReload()`** —— 重载（地图视野重置到全览）
  - 复用现有 `setFitView(markers + polyline, false, [80, 80, 200, 80], 16)`。
  - 没有点位时 toast 提示。
- `<MapTopToolbar>` 调用补传 `onLaunchNav={handleLaunchNav}` 与 `onReload={handleReload}`。

**注意**：高德官方对 URI API 中的中文地名做 URL 编码，且要求 `coordinate=gaode`（GCJ02）；我们路线里的点都是 GCJ02，无需再转。

---

### 2026-05-03 · 导入功能改为本地文件解析（v1.12）

**变更**：之前的「导入」按钮只是 toast 占位，预期接入后端文件存储。本次取消后端接入，改为**纯前端**解析本地文件，不上传到任何服务器。

**支持格式**：
| 格式 | 字段 | 抽样策略 |
|---|---|---|
| `.gpx` | `<wpt>`（标记点）/ `<rtept>`（路线点）/ `<trkpt>`（轨迹点） | 优先 wpt → rtept → trkpt；trkpt 抽样最多 20 个 |
| `.tcx` | `<Trackpoint><Position>` | 抽样最多 20 个 |
| `.kml` | `<Placemark><Point>`、`<LineString>` | Point 全部保留；LineString 每条抽样 10 个 |
| `.csv` | `lng,lat,name?` 每行 | 全部保留，自动跳过表头 |

**实现要点**：
- `lib/coord.ts`：纯 JS 实现 **WGS-84 → GCJ-02** 火星坐标偏移算法（GPS 文件都是 WGS-84，高德地图是 GCJ-02，不转会有 50-500 米偏差）。境外坐标自动跳过偏移。
- `lib/import-route.ts`：`parseRouteFile(file): Promise<ImportResult>`
  - 按扩展名分发到 `parseGpx` / `parseTcx` / `parseKml` / `parseCsv`；无扩展名时按文件内容嗅探。
  - XML 用 `DOMParser`（浏览器原生），无第三方依赖。
  - 所有点经 `wgs84ToGcj02` 转换后封装为 `AmapPOI`，与搜索 / 地图点选的数据结构完全一致，可直接进入 `useRoutePlanner`。
  - 抽样函数 `sample()` 等距取首尾必含。
- `hooks/use-route-planner.ts`：新增 `addWaypoints(pois: AmapPOI[])`，单次 setState 内批量加点（避免 N 次串行 setState）。
- `components/route-planner/bottom-toolbar.tsx`：用隐藏 `<input type="file" accept=".gpx,.tcx,.kml,.csv,...">` + ref 触发；选中后回调 `(file: File) => void`，并 reset value 让用户能重选同一文件。
- `app/page.tsx` 的 `handleImport(file)`：
  - 先弹 `toast.loading("正在解析文件…")`。
  - 调 `parseRouteFile(file)` → `planner.addWaypoints(result.pois)` → 成功 toast 显示 `${format} · ${name} · ${notice}`。
  - 解析失败 → 错误 toast，原文件错误信息透出。
  - 自动 `setOverviewSignal(s => s + 1)` 触发地图全览到所有导入的点位。

**安全性**：所有解析都在浏览器端完成，文件内容不会发送到服务器，不依赖任何 API Key。

**示例文件**（可手动构造测试）：
```csv
116.4074,39.9042,天安门
116.4319,39.9985,鸟巢
116.3974,39.9087,故宫
```

---

### 2026-05-03 · 任意位置点击地图都可加点（v1.11）

**需求**：之前只有点击底图自带的 POI 标签（公园、地铁站、商场等热点）才会弹出信息卡，点击空白区域必须先开"地图选点"模式才能加点，发现性差。希望在地图上任何位置都能直接点击加点。

**实现**：
- `app/api/amap/regeo/route.ts`：
  - 接口升级为 `extensions=all` + `radius=200`，让高德同时返回最近 POI 与最近道路。
  - 新增 `pickFriendlyName(regeo, city)`，用户点击空白处时按以下优先级生成名称：
    1. 最近 POI（≤50m 直接用名，≤200m 加"附近"后缀）
    2. 最近道路 → `XX 路附近`
    3. 街道号 → `XX 街 X 号附近`
    4. 乡镇/街道 → `XX 镇附近`
    5. 区县 → `XX 区附近`
    6. 兜底 `城市地图点选`
- `components/route-planner/amap-view.tsx`：
  - `map.on("click")` 改写：
    - 选点模式（pickMode）保留：直接反查并加点，无弹卡（一键多点高效模式）。
    - 普通模式新增：弹出与 hotspotclick 一样的信息卡（loading 态 → 反查 → 启用按钮），让用户确认后再加入路线。
    - 这样无论点 POI 标签还是空白处，交互完全一致。
  - 引入 `lastHotspotTsRef`：hotspotclick 触发时写入时间戳，click 处理函数检查 250ms 内是否刚处理过 hotspot——避免点击 POI 时 click 与 hotspotclick 同时触发导致弹两次卡。

**用户体验**：
- 在地图上任何位置（不论 POI 还是空白）单击 → 弹出统一的信息卡 → 点「+ 添加到路线」即加入。
- 想批量快速加点时仍可开启"地图选点"模式，点哪儿就加到哪儿、无需弹卡确认。

---

### 2026-05-03 · 修复骑行模式视觉无差别（v1.10）

**现象**：右上角图层切换器选择「骑行」后，地图与「标准」模式视觉完全相同，看不出有任何区别。

**根因**：原实现 `cycling` 分支用了 `amap://styles/normal`（与 `standard` 完全一样的底图样式）+ `AMap.TileLayer.Traffic` 实时路况图层。Traffic 在小缩放级别下几乎不可见，加上底图样式相同，所以视觉��完全无差别。

**修复**：每个模式选用视觉差异明显的高德官方样式，并加显式图例。

- `components/route-planner/amap-view.tsx` 图层 useEffect：
  - **standard** → `amap://styles/normal`（默认配色）
  - **satellite** → `normal` 底图 + `Satellite` 卫星瓦片 + `RoadNet` 路网
  - **terrain** → `amap://styles/whitesmoke`（雅黑灰，突出地势线条）
  - **cycling** → `amap://styles/fresh`（**清新蓝绿底图**，与标准模式有显著色差）+ `Traffic` 图层（`zIndex:10`，`autoRefresh:true`，`interval:180`）
  - 增加 `console.log("[v0] map layer =>", layer)` 便于切换时验证。
- 新增「骑行模式」专用**路况图例角标**（地图右上方图层切换器下方）：绿/黄/红三色圆点 + 「畅通 / 缓行 / 拥堵」文字，让用户一眼识别 Traffic 颜色含义。

**视觉效果**：
- 标准 → 经典灰白蓝
- 卫星 → 真实卫星图像 + 道路名标注
- 地形 → 低饱和度雅白
- 骑行 → **清新蓝绿色调** + 道路上叠加实时路况彩色线（绿/黄/红） + 右上图例

**注意**：路况图层在缩放 ≥ 11 才能看到清晰的道路线条，更小缩放下可能只看到主干道。地图在打开骑行模式后会自动每 180 秒刷新一次路况。

---

### 2026-05-03 · 准星按钮改为 GPS 定位 + 删除空齿轮按钮（v1.9）

**需求**：地图右下角原本有两个按钮（上：准星 Crosshair，下：齿轮 Settings2）。准星按钮之前误绑到了 `handleReset`（其实是路线全览），齿轮按钮没绑事件。
- 准星 → **定位到我的位置**：一键将地图中心切换到用户当前 GPS 位置。
- 齿轮 → **删除**。

**实现**：
- `components/route-planner/map-toolbar.tsx`：
  - 删除齿轮按钮和未使用的 `Settings2` 图标导入。
  - 准星按钮支持 `locating` 状态：定位中显示蓝色 spinner、disabled、`cursor-wait`。
- `components/route-planner/amap-view.tsx`：
  - `AMapNS` 类型扩展 `setCenter` / `setZoom` / `setZoomAndCenter` / `convertFrom`。
  - JS API 加载时新增 `AMap.convertFrom` 插件（用于 WGS84 → GCJ02 坐标转换）。
  - 新增 `handleLocate()`：
    1. 调用 `navigator.geolocation.getCurrentPosition`（`enableHighAccuracy:true`, `timeout:10s`, `maximumAge:30s`）。
    2. 用 `AMap.convertFrom([lng, lat], "gps", cb)` 把浏览器返回的 WGS84 坐标转成高德 GCJ02（不转换会有几十到几百米偏移）。
    3. `map.setZoomAndCenter(16, [lng, lat])` 将地图中心切到该坐标。
    4. 在该位置渲染一个**蓝色脉冲圆点 marker**（18px，白边 + 蓝色光晕），通过 `userLocationMarkerRef` 单实例管理，每次定位先移除旧的。
    5. 成功 toast：`已定位到当前位置 · lng, lat`。
    6. 失败时根据 `err.code` 区分三种原因（`PERMISSION_DENIED` / `POSITION_UNAVAILABLE` / `TIMEOUT`），分别给出中文 toast。
  - 新增 `userLocationMarkerRef` 与 `locating` 状态。

**注意**：浏览��� Geolocation 需要 HTTPS（v0 预览域名 `*.vusercontent.net` 已是 HTTPS），首次使用浏览器会弹权限提示，用户需要点「允许」。如果用户拒绝过，需要在地址栏左侧重新授予权限。

---

### 2026-05-03 · 修复底图 POI 添加后地址显示「加载中...」（v1.8）

**现象**：在地图上点击底图自带的 POI 标签，弹窗出现后立即点「+ 添加到路线」，加入点位管理后名称下方显示「加载中…」而不是真实地址。

**根因**：v1.4 的 hotspotclick 处理是这样的——
1. 第一帧立刻 `setContent(... address: "加载中…", onAdd: handleAdd)` 并打开弹窗。
2. 异步 `await reverseGeocode(...)` 反查地址。
3. 反查完成后 `setContent(...)` 用真实地址重新渲染。

但 `handleAdd` 闭包里读取的是闭包中 `let addressBuf`，**用户在第 1 步和第 3 步之间点击按钮**就会把 `"加载中…"` 写进 `Waypoint.poi.address`。在网络稍慢的情况下这���时间窗几乎是必现 bug。

**修复**：
- `components/route-planner/amap-view.tsx` 中 `createPoiPopup` 增加 `loading?: boolean` 参数：`true` 时按钮显示「正在解析地址…」、`disabled`、灰色背景、`cursor: wait`，**不绑定 click 事件**，从根本上禁止提前点击。
- `hotspotclick` 处理重写：
  - 闭包内用 `let address = fallbackAddress`（fallback = `lng.toFixed(5),lat.toFixed(5)`），`cityname` / `adname` 同样用 `let` 持有。
  - 第一帧 `loading: true`，address 显示「正在解析地址…」（**仅 UI 文案**，不会被写入点位）。
  - regeo 完成后更新 `address / cityname / adname` 三个闭包变量，再 `setContent({ loading: false, ... })` 启用按钮。
  - regeo 失败时 `address` 保留 fallback（坐标字符串），按钮也启用。
  - 用户点击「+ 添加到路线」时 `handleAdd` 读到的 `address` 已经是真实值或坐标兜底，**永远不会是 UI 文案**。
- `cityname` / `adname` 也一并写入 POI（之前漏了），与搜索结果保持字段一致。

---

### 2026-05-03 · 修复多点骑行规划 21002 + 网络超时重试（v1.7）

**问题 1（500 报错）**：
日志中频繁出现 `POST /api/route/plan 500` 与 `[TypeError: fetch failed] code: ETIMEDOUT`。这是 sandbox/容器出口网络抖动导致首次连接 `restapi.amap.com` 超时，并非高德拒绝请求，重试一次基本就能成功。

**问题 2（502 / 21002）**：
日志显示——只要请求里带 `waypoints=...`（多途经点），高德就返回 `errcode: 21002 HAVE_NO_PERMISSION`；不带途经点（仅起+终）则正常返回 200。

**根因**：**高德骑行规划 v5（`/v5/direction/bicycling`）不支持 `waypoints` 参数**，这个能力只在驾车规划里有。原代码把 `waypoints` 拼到 URL 上是错误用法，21002 不是权限问题而是"接口不识别该参数"。这与"控制台路径规划权限"无关。

**修复**：
- 新增 `lib/fetch-amap.ts`：
  - `fetchAmap(url, { timeoutMs=7000, retries=2, retryDelayMs=300 })` 统一封装 7 秒超时 + 1 次自动重试。
  - `networkErrorPayload(e)` 把 `ETIMEDOUT` / `ENOTFOUND` 翻译成中文友好提示。
- `app/api/route/plan/route.ts` 重写：
  - 把 `[origin, ...waypoints, destination]` 按相邻顺序拆成 N-1 段「起→终」串行调用骑行 v5（每段都不带 waypoints）。
  - 拼接所有段的 `path` / `steps` / `distance` / `duration`，跨段去重首点。
  - 包一层 `try/catch`：业务错误（高德返回错误码）走 `explainAmapError` 翻译；网络错误走 `networkErrorPayload`，前端面板和 toast 都能区分两类原因。
  - 错误码对照表新增 `21002` 条目。
- `app/api/amap/regeo/route.ts` 与 `app/api/amap/search/route.ts` 都换用 `fetchAmap`，并对网络异常返回 502 + `code: NETWORK_TIMEOUT`，避免直接 500 让 UI 收到不可读的错误。
- `app/api/amap/search/route.ts` 的 `place/text` 兜底请求失败时改为静默忽略（不影响主结果返回）。

**效果**：
- 之前 5 个点的路线规划 → 502 21002；现在 → 4 段串行 → 200 完整路线。
- 之前偶发 ETIMEDOUT → 500；现在 → 自动重试 1 次，成功率显著提升；仍失败时返回友好的"网络抖动，请稍后重试"提示。

---

### 2026-05-02 · 搜索结果改为浮层，解决与点位管理的空间冲突（v1.6）

**问题**：在 v1.3 的"五段式 flex 布局"下，地点搜索结果（`max-h-[32vh]`）和路线操作区（`max-h-[38vh]`）共占了 70% 视口，导致中间「点位管理」被挤压到只能显示 1-2 条点位，体验非常差。两个搜索框（搜索 + 列表过滤）也容易让用户混淆。

**修复**：把搜索结果改成 **绝对定位浮层**，覆盖在点位管理之上，不再占据流���空间。

- `components/route-planner/search-section.tsx`：
  - 新增 `open` 状态控制浮层显示，初始 `false`，点击搜索按钮 / Enter / 输入框聚焦时打开。
  - 结果区改为 `absolute left-3 right-3 top-full z-30 mt-1.5`，高度上限 `max-h-[min(60vh,520px)]`，自带阴影 + 圆角浮��。
  - 浮层头部新增「关闭」按钮（X 图标）和当前结果数说明。
  - 选中 POI 后自动收起（`handleSelect`），把屏幕空间还给点位管理。
  - 监听 `mousedown` 实现「点击外部关闭」，监听 `keydown` 支持 ESC 关闭。
  - 当浮层关闭但仍有缓存结果时，标题右侧显示「N 条结果 · 展开」按钮，方便重新打开。
- `components/route-planner/left-panel.tsx`：
  - 搜索区容器加 `relative z-20`，确保浮层 z-index 生效。
  - 点位管理 `min-h-0` → `min-h-[200px]`，保证至少能稳定展示 3-4 条点位。

**用户体验提升**：
- 搜索框始终保持紧凑（约 80px 高度），不再因为搜索而压缩点位列表。
- 点位管理可见高度增加约 35-40%（视设备）。
- 双重过滤搜索（地点搜索浮层内 + 点位管理 header）功能完全保留。

---

### 2026-05-02 · 路线规划错误诊断 + 高德错误码翻译（v1.5）

**问题**：用户反馈"有时候规划路线时会出现 have no permission 错误"。原实现只把 `errmsg` 透传给前端，用户看不到具体错误码也不知道该怎么修。

**根因**：`have no permission`（高德 errcode `10009 / 10012 / 10024`）几乎都是 **AMAP_WEB_KEY 在高德控制台没勾选「路径规划」服务**。还有以下情���会出错但提示混淆：

| errcode | errmsg | 真实原因 | 修复方法 |
|---|---|---|---|
| 10001 | INVALID_USER_KEY | Key 不存在 | 重新创建 |
| 10003 | DAILY_QUERY_OVER_LIMIT | ���人 5000 次/日额度用完 | 等次日 0 点，或升级配额 |
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
2. 找到对应的 `AMAP_WEB_KEY`（注��不是前端 JS API Key）。
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
  - 类型 `AMapInstance.on` ��为重载形式，分别为 `click` / `hotspotclick` / 通用 `string` 提供精确事件类型。
  - 新增 `AMapInfoWindowInstance` 与 `AMapNS.InfoWindow`。
  - 新增工具函数 `createPoiPopup(opts)` 返回原生 `HTMLElement`，按钮通过 `addEventListener` 绑定，无需依赖全局函数。
  - 新增 `onPickPointRef` 与 `infoWindowRef`。

---

### 2026-05-02 · 左侧面板响应式布局 + 双重过滤搜索（v1.3）

**问题**：
1. 左侧固定 380px，在小屏（< 1280px）时挤压地图视野；大屏（> 1920px）又���得过窄。
2. 整个左侧用一个外层 `ScrollArea` 滚动，搜索结果一旦变多，会把"点位管理"挤���屏幕外，体验差。
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

**现象**：日志显示 `[v0] AMap JS API 加载成功，创建地图实例` 一切���常，状态切换为 `ready`，但用户看到的右侧地图���域**完全空白**（瓦片不渲染）。

**根因**：高德 `new AMap.Map(container, ...)` 创建时如果 `container` 的 `clientWidth` / `clientHeight` 为 0，瓦片无法计算视口范围，**地图实例正常创建但什么都不画**。

之前的容器层级 `flex-1 flex flex-col overflow-hidden` + 子级 `absolute inset-0`��在某些 flex 链路（缺 `min-h-0` / `min-w-0`）下，绝对定位子元素会被压缩到 0×0。

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

> 若 Key 创建时勾选了「设置安全密钥(securityJsCode)」，必须与 `NEXT_PUBLIC_AMAP_SECURITY_CODE` 一致；该方案会把 securityJsCode 暴露在浏览器，仅适合**开发环境**。生产环��推荐用代理方案（见下方"生产强化"章节，待补充）。

---

### 2026-05-02 · 接入真实高德 API（v1.0）

**已完成**：项目已从 mock 模式切换到真实高德 API，可直接使用。

- 新增依赖：`@amap/amap-jsapi-loader@^1.0.1`
- 新增服务端代理路由（保护 Web 服务 Key，仅服务端读取 `AMAP_WEB_KEY`）：
  - `app/api/amap/search/route.ts` —— POI 搜索（输入提示 + 关键字检索兜底）
  - `app/api/amap/regeo/route.ts` —— 逆地理编码���地图点选反查地址）
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

切换到真实 DEM ��，仅需替换 `estimateElevationProfile()`：

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
