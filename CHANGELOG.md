# Changelog

## [2.1.0] - 2026-04-14

### 冲煮日志 (Brew Journal)

新增冲煮日志功能，用于记录每次冲煮的豆子、参数与风味反馈。视觉上模拟手帐式两栏纸质对开页（左：参数；右：风味与反思），完全本地存储，零第三方依赖。

### Added
- **路由层**：哈希路由 `#/`、`#/log`、`#/log/<id>`，新增顶部 `换算 ｜ 日志` 标签切换
- **数据层 `BrewLog`**：`createEntry / load / save / sanitizeEntry / mergeImport / exportPayload`，存储键 `grinder-brew-log-v1`，schema 版本化
- **两栏对开页**：左页记录豆子 / 磨豆机 / 冲煮参数 / 萃取数据，右页留给风味与反思；< 900px 宽度自动竖排堆叠
- **编辑体验**：所有字段 `contenteditable`，失焦自动保存；日期字段聚焦切 ISO，失焦回中文/英文长格式
- **键盘快捷键**：`←/→` 翻页、`N` 新建一篇；编辑态自动屏蔽，不会误触
- **评分**：`✦/✧` 五星，再次点击同一星级可清零
- **导入 / 导出 JSON**：导入按 `id` 合并，冲突时保留 `createdAt` 较新者
- **手帐质感**：引入 Caveat + 马善政 Google Fonts，SVG 噪点纸纹，散落角点装饰
- **i18n 同步**：`换算 / 日志` 与 `记录这次冲煮 →` 跟随中英文切换
- **测试**：新增 `tests/brew-log.test.mjs`，覆盖 schema 默认值、sanitize、import / export 往返、merge 冲突策略、损坏 JSON 兜底

### Notes
- 单文件架构维持不变，所有逻辑仍在 `index.html`
- 数据完全离线、不上传任何服务端

---

## [2.0.0] - 2026-02-17

### 侘寂视觉重设计 (Wabi-Sabi Visual Redesign)

纯视觉层改动，所有功能逻辑与交互流程保持不变。

### Changed
- **色彩体系**: 从通用工具风格切换至日式侘寂美学
  - 亮色模式: 和纸米白背景 (#f5f0e8)、墨色文字 (#2d2a26)、抹茶绿交互色 (#6b7c5e)、赤土结果色 (#c45c3c)
  - 深色模式: 暖棕墨色背景 (#1a1714) 取代纯黑，奶白文字 (#e8e0d4)
- **字体排版**: 标题与结果数值使用 Noto Serif SC 衬线体，全局增加字间距
  - 卡片标题: 12px 小写转大写，字间距 0.12em
  - 结果数值: 52px 衬线体，赤土色
  - 副标题: 字间距 0.15em
- **卡片样式**: 移除边框，改用极淡阴影 (`box-shadow: 0 1px 3px rgba(45,42,38,0.06)`)，圆角从 12px 缩减至 6px
- **输入框/下拉框**: 圆角从 8px 缩减至 4px，焦点色改为抹茶绿
- **语言切换**: 从按钮样式改为纯文字链接形态 `中文 · EN`
- **冲煮推荐条**: 背景改为抹茶绿淡底
- **警告条**: 背景改为暗金淡底
- **Disclaimer**: 移除边框和背景，纯淡灰文字
- **方向箭头**: 墨色取代蓝色
- **K-Ultra 记号**: 次要文字色取代强调蓝

### Added
- Google Fonts 引入 Noto Serif SC (600/700 字重)，含 preconnect 优化

---

## [1.1.0] - 2026-01-29

### Deployment
- 项目开源至 GitHub: https://github.com/ismedon/grinder-converter
- 启用 GitHub Pages 在线访问: https://ismedon.github.io/grinder-converter/
- 添加仓库标签: coffee, grinder, converter, comandante, 1zpresso, mahlkonig, ek43

### Added
- **Mahlkönig EK43 磨豆机支持**
  - 刻度范围: 0-16（无级调节，支持小数如 0.5, 7.5）
  - 与 C40、K-Ultra 双向转换
  - 转换系数: K-Ultra / EK43 = 10.67

- **新 UI: 下拉菜单选择器**
  - 将原有的单选按钮改为两个下拉菜单
  - 支持选择任意源设备和目标设备
  - 选择相同磨豆机时显示友好提示

- **EK43 冲煮方式推荐**
  - 意式浓缩: 0.3-1
  - 摩卡壶: 1-3
  - 爱乐压（浓缩风格）: 3-6
  - V60 / 手冲: 6-9
  - 爱乐压（清淡风格）: 9-11
  - 法压壶: 11-13
  - 冷萃: 13+

### Changed
- 重构转换逻辑，采用 K-Ultra 作为中间值进行转换
- 输入框根据源设备动态调整 step 属性（EK43 支持 0.1 步进）
- 更新 SEO 元数据包含 EK43 和 Mahlkönig 关键词

### Technical Details
- 新增 `GRINDERS` 配置对象管理磨豆机参数
- 新增转换函数: `toKUltra()`, `fromKUltra()`, `convertValue()`, `formatResult()`
- 新增 `getBrewMethodByEK43()` 冲煮方式推荐函数
- i18n 配置扩展支持 EK43 相关文本

---

## [1.0.0] - Initial Release

### Features
- Comandante C40 ↔ 1Zpresso K-Ultra 刻度互转
- K-Ultra 刻度格式说明 (X.Y.Z 格式)
- 冲煮方式推荐
- 中英文双语支持
- 深色模式支持
- 响应式设计
