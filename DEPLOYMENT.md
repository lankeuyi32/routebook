# 骑行路书制作 · 上线接入清单

本文件列出从 v0 预览版本到生产上线需要完成的所有改动，按优先级排列。**所有 mock 数据已严格隔离在 `lib/mock/` 目录，切换真实 API 时只需修改两个开关。**

---

## 1. 高德地图 Key 与环境变量

> 高德 Web 服务 Key **严禁**出现在前端 bundle，只有 JS API 的 Web 端 Key 才允许在浏览器使用，且必须配置域名白名单。

在 Vercel 项目设置 → Environment Variables 中添加：

| 变量名 | 作用域 | 说明 |
| --- | --- | --- |
| `AMAP_WEB_SERVICE_KEY` | Server | 高德 Web 服务 Key，仅在后端 Route Handler 中使用 |
| `AMAP_WEB_SERVICE_SECRET` | Server | 高德"数字签名"安全密钥（开启数字签名校验时必填） |
| `NEXT_PUBLIC_AMAP_JS_KEY` | Client | 高德 JS API Web 端 Key（已在控制台白名单绑定 `*.vercel.app` 与正式域名） |
| `NEXT_PUBLIC_AMAP_SECURITY_JS_CODE` | Client | JS API 安全密钥（仅当控制台开启时） |

> 控制台地址：<https://console.amap.com/dev/key/app>
> 配额建议：地点搜索、路径规划日均≥10w 次。

---

## 2. 切换真实 API 开关（最关键）

打开下面两个文件，将顶部的 `USE_REAL_API` 由 `false` 改为 `true`：

- `services/amap.ts`
- `services/route.ts`

切换后，`lib/mock/mock-pois.ts` 与 `lib/mock/mock-route.ts` 不再被引用，可以删除整个 `lib/mock/` 目录。

---

## 3. 实现后端 Route Handlers

需要新增以下 Next.js Route Handler，全部使用服务端 `AMAP_WEB_SERVICE_KEY` 调用高德官方接口：

### 3.1 `app/api/amap/search/route.ts`

调用高德[关键字搜索 V3](https://lbs.amap.com/api/webservice/guide/api/search) 或 [输入提示](https://lbs.amap.com/api/webservice/guide/api/inputtips)：

```
GET https://restapi.amap.com/v3/place/text
    ?keywords={kw}&city={city}&offset={pageSize}&page={page}&key={AMAP_WEB_SERVICE_KEY}
```

将返回字段映射为 `AmapPOI[]`（参见 `types/route.ts`），并把 `location` 字段拆解为 `lngLat`。

### 3.2 `app/api/amap/regeo/route.ts`

调用[逆地理编码 V3](https://lbs.amap.com/api/webservice/guide/api/georegeo)：

```
GET https://restapi.amap.com/v3/geocode/regeo?location=lng,lat&key={key}
```

### 3.3 `app/api/route/plan/route.ts`

调用[骑行路径规划 V5](https://lbs.amap.com/api/webservice/guide/api/newroute)：

```
GET https://restapi.amap.com/v5/direction/bicycling
    ?origin={lng,lat}&destination={lng,lat}&waypoints={lng,lat;...}&show_fields=cost,polyline&key={key}
```

将 `paths[0].polyline` 解析为 `LngLat[]` 后返回，并基于 `cost.duration`、`distance` 拼装 `RoutePlanResult`。

### 3.4 `app/api/route/elevation/route.ts`

高德官方暂未提供独立的 DEM 接口，可任选其一：

- 自建 DEM：基于开源 SRTM/ALOS 数据，使用 GDAL 切片后通过 `/api/route/elevation` 反查；
- 第三方：[OpenTopoData](https://www.opentopodata.org/) (`/v1/srtm90m`) 或 Mapbox Tilequery；
- 商用：高德"位置补充服务"中的高程接口（需联系商务）。

请求体 `{ path: LngLat[] }`，返回 `ElevationPoint[]`，并在后端计算 `ascent / descent / maxGrade` 后写回 `RoutePlanResult`。

### 3.5 数字签名校验（强烈建议）

如果在高德控制台开启了"数字签名"，需要在后端按官方文档拼接 `sig`：

```ts
const sig = md5(sortedQueryString + AMAP_WEB_SERVICE_SECRET)
```

参考：<https://lbs.amap.com/api/webservice/guide/create-project/get-key>

---

## 4. 用真实 AMap JS 替换 SVG 地图

`components/route-planner/map-view.tsx` 当前使用 SVG 渲染演示底图。生产环境应：

1. 安装官方加载器：

   ```bash
   pnpm add @amap/amap-jsapi-loader
   ```

2. 在 `MapView` 顶部使用 `useEffect` 初始化地图（参考 [JS API v2 文档](https://lbs.amap.com/api/javascript-api-v2/summary)）：

   ```ts
   import AMapLoader from "@amap/amap-jsapi-loader"

   useEffect(() => {
     AMapLoader.load({
       key: process.env.NEXT_PUBLIC_AMAP_JS_KEY!,
       version: "2.0",
       plugins: ["AMap.Bicycling", "AMap.PlaceSearch", "AMap.Scale", "AMap.ToolBar"],
     }).then((AMap) => {
       const map = new AMap.Map(containerRef.current, {
         viewMode: "2D",
         zoom: 12,
         mapStyle: "amap://styles/normal",
       })
       mapRef.current = map
     })
     return () => mapRef.current?.destroy()
   }, [])
   ```

3. 将 `waypoints` / `route.path` 同步为 `AMap.Marker` 与 `AMap.Polyline`：

   ```ts
   const polyline = new AMap.Polyline({
     path: route.path,
     strokeColor: "#1d8eff",
     strokeWeight: 6,
     showDir: true,
   })
   map.add(polyline)
   map.setFitView([polyline, ...markers])
   ```

4. 图层切换映射到官方图层：

   | UI 选项 | AMap 实现 |
   | --- | --- |
   | 标准 | `mapStyle: "amap://styles/normal"` |
   | 卫星 | `map.add(new AMap.TileLayer.Satellite())` |
   | 地形 | `mapStyle: "amap://styles/whitesmoke"` + 地形瓦片 |
   | 骑行 | `map.add(new AMap.TileLayer.RoadNet())` + Bicycling 路线高亮 |

5. 删除 `MapBackground` 函数与所有 SVG 装饰元素。

---

## 5. 实现导入 / 导出

新建 `services/export.ts`，将 `RoutePlanResult` + `Waypoint[]` + `ElevationPoint[]` 序列化为：

- **GPX 1.1**：`<gpx><trk><trkseg><trkpt lat lon><ele>`
- **TCX**：`<TrainingCenterDatabase><Activities><Lap><Track><Trackpoint>`
- **KML**：`<kml><Document><Placemark><LineString><coordinates>`
- **CSV**：自定义字段（lat, lng, ele, distance, duration）

`app/page.tsx` 中的 `handleExport` / `handleImport` 替换为真实下载与解析（推荐用 `fast-xml-parser`）。

---

## 6. 拉起导航

`components/route-planner/map-toolbar.tsx` 中的"拉起导航"按钮，对接：

- 高德地图 URI API（移动端唤起）：<https://lbs.amap.com/api/uri-api/guide/travel/route>
  ```
  https://uri.amap.com/navigation?from={lng,lat}&to={lng,lat}&via={...}&mode=ride
  ```
- 桌面端可生成二维码或打开 <https://www.amap.com/dir?type=ride&...>

---

## 7. 数据真实化检查清单

上线前逐项确认 UI 中**没有硬编码假数据**：

- [ ] 地点搜索结果全部来自 `/api/amap/search`
- [ ] 点位列表 `name / address / cityname / adname / lngLat` 全部使用接口字段
- [ ] 路线 polyline 来自 `/api/route/plan` 的 `path`
- [ ] `distance / duration / ascent / descent / maxGrade` 全部来自后端
- [ ] 海拔剖面来自 `/api/route/elevation`
- [ ] `lib/mock/` 已删除，全局搜索 `MOCK_` / `示例` 应零结果
- [ ] `services/*` 中 `USE_REAL_API` 都是 `true`

---

## 8. 性能与可靠性

- 搜索接口加 300~500ms 防抖（推荐 `useDebounce`）。
- 路径规划返回的 `path` 在长距离骑行时可达数千点，绘制 SVG/Polyline 前用 [Douglas-Peucker](https://github.com/mourner/simplify-js) 简化到 ≤500 点。
- 海拔剖面 hover 用 `requestAnimationFrame` 节流。
- 后端对高德接口加 Redis 缓存（key=`amap:search:{kw}:{city}`，TTL 1h）。
- 用户操作（添加/排序/规划）建议接入 Sentry 或 PostHog 监控。

---

## 9. 安全

- 后端 Route Handler 必须校验来源（同源 + Origin 白名单），防止 Key 被盗刷。
- 在响应头配置 `Cache-Control: private`，避免敏感地理信息被 CDN 缓存。
- 用户上传的 GPX/TCX 文件解析前做大小限制（≤5MB）和 schema 校验。

---

## 10. 上线步骤

1. 在高德开放平台申请 Web 服务 Key + JS API Key，开通"骑行路径规划"配额。
2. 将四个环境变量配置到 Vercel。
3. 完成第 3、4、5 节代码改造，本地 `pnpm dev` 联调。
4. 删除 `lib/mock/` 目录，运行 `pnpm build` 确认零警告。
5. 部署到 Preview，在真实域名下验证 JS API 白名单。
6. 切换到 Production。

---

完成以上 10 步后，本项目即可作为真实骑行路线规划工具上线。
