# Mock 数据隔离区

⚠️ 本目录下所有文件**仅用于 v0 预览环境的 UI 演示**。

## 接入真实高德地图 API 时的处理

1. 打开 `services/amap.ts` 与 `services/route.ts`，将顶部的 `USE_REAL_API` 常量设置为 `true`。
2. 实现 `app/api/amap/*` 与 `app/api/route/*` 的 Next.js Route Handlers，使用服务端环境变量 `AMAP_WEB_SERVICE_KEY` 调用高德 Web 服务 API。
3. 确认所有功能切换到真实数据后，可以删除本目录或保留作为单元测试夹具。

## 数据字段约束

- 所有 mock POI 的 `id`、`name`、`address` 都带有 "示例" / "MOCK_" 前缀，避免被误认为真实数据。
- `mockPlanRoute` / `mockElevationProfile` 仅基于经纬度做线性插值与正弦扰动，**不能反映真实道路、距离、耗时、爬升**。
- 组件中**严禁**直接 import 本目录的内容，必须经由 `services/*` 暴露，以保证生产构建可一键切换。
