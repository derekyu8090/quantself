<div align="right">

中文 | [English](README.md)

</div>

<div align="center">

# QuantSelf

**开源个人健康仪表盘，基于 Apple Health 数据驱动。**

循证健康评分 | 交互式图表 | macOS 桌面应用 | 隐私优先

[功能](#功能) | [快速开始](#快速开始) | [架构](#架构) | [路线图](#路线图)

---

</div>

## QuantSelf 是什么？

QuantSelf 将你的 Apple Health 导出数据转化为一个交互式、基于循证医学的健康仪表盘。它计算两个复合健康评分，可视化 20+ 项指标（覆盖 8 个面板），并完全在本地运行——你的数据永远不会离开你的电脑。

```
iPhone 健康导出 --> Python 管线 --> JSON 数据 --> React 仪表盘 / Tauri 桌面应用
```

## 功能

### 8 个交互面板

| 面板 | 指标 | 亮点 |
|------|------|------|
| **心血管** | 静息心率、HRV、VO2Max、血氧、步行心率 | 24小时心率分布、呼吸频率趋势 |
| **睡眠** | 时长、核心/深睡/REM 阶段、入睡时间 | 入睡时间热力图、呼吸障碍指数、手腕温度 |
| **活动** | 步数、锻炼时长、站立时长、运动记录 | 游泳心率区间分析、GitHub 风格日历热力图 |
| **风险与目标** | 6维风险评估、目标追踪 | 数据驱动的动态风险评分、异常事件时间线 |
| **对比** | 任意两个时间段对比 | 并排 StatCards 含变化值、叠加趋势图 |
| **心电图** | 心电图记录 | 波形可视化 + Apple 分类标签 |
| **指标说明** | 8项核心健康指标详解 | 是什么、正常范围、为什么重要、如何改善 |
| **运动恢复** | 运动 vs 次日 HRV/RHR | 时长-恢复散点图、恢复时间线 |

### 两个复合健康评分

**每日健康评分 (0-100)** — 你今天状态怎么样？
- 加权计算：睡眠(25%) + HRV(20%) + 静息心率(15%) + 活动(15%) + 恢复(15%) + 体成分(10%)
- 每日更新，对昨晚睡眠和今日活动敏感

**长期健康评分 (0-100)** — 长期健康趋势
- 基于循证医学，按荟萃分析效应量加权：

| 维度 | 权重 | 关键文献 |
|------|------|----------|
| 最大摄氧量 (VO2Max) | 25% | Kodama 2009, JAMA — 每 MET 死亡率降 13% |
| 睡眠规律性 | 20% | Windred 2024, Sleep — SRI 比睡眠时长更具预测力 |
| 活动水平 | 20% | Paluch 2022, Lancet — 8000步 = 死亡率降 45% |
| 心率变异性 | 15% | Hillebrand 2013, Europace — SDNN 预测心血管事件 |
| 身体成分 | 10% | Jayedi 2022, Int J Obes — J型曲线 |
| 血氧饱和度 | 5% | Yan 2024, J Clin Sleep Med — 夜间 SpO2 |
| 静息心率 | 5% | Aune 2017 — 每升高 10bpm 死亡率升 9% |

### 其他功能

- **日/夜模式** — 简约高级设计，流畅主题切换
- **中/英文** — 完整双语界面
- **日期范围筛选** — 全部、30天、90天、6个月、1年、自定义
- **基线告警** — 个人30天滚动基线，偏离 1.5 标准差时告警
- **成就系统** — 运动/睡眠/步数连续天数 + 个人记录
- **PDF 导出** — 一键生成打印优化的健康报告
- **日历热力图** — GitHub contribution graph 风格（睡眠、步数）
- **macOS 桌面应用** — 12MB 原生 Tauri 应用，含系统托盘
- **iCloud 自动同步** — fswatch 监听新导出，自动更新仪表盘

## 架构

```
                    +------------------+
                    |   iPhone 健康     |
                    |   (手动导出)       |
                    +--------+---------+
                             |
                    export.xml (1GB+)
                             |
                    +--------v---------+
                    |  process_data.py |  <-- 流式 XML 解析器
                    |  (Python, 无依赖) |     处理百万级记录
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     cardiovascular.json  sleep.json   activity.json
              |              |              |
              +------+-------+------+-------+
                     |              |
                overview.json    ecg.json
                     |
     +---------------+---------------+
     |               |               |
   每日评分        长期评分          风险评分
  (每天 0-100)   (每月 0-100)     (6个维度)
                     |
              +------v------+
              |   React UI  |  <-- Recharts, CSS Variables
              |  (Vite SPA) |     日/夜模式, 中/英文
              +------+------+
                     |
         +-----------+-----------+
         |                       |
    localhost:5173          Tauri 桌面应用
    (npm run dev)          (12MB .app)
```

### 数据流

```
Apple Health XML
  |
  |-- HeartRate                       --> cardiovascular.json
  |-- RestingHeartRate                   |-- rhr (每日 + 月度)
  |-- HeartRateVariabilitySDNN           |-- hrv (每日 + 夜间/日间)
  |-- VO2Max                             |-- vo2max (记录 + 统计)
  |-- OxygenSaturation                   |-- spo2 (24小时分布)
  |-- RespiratoryRate                    |-- respiratory (月度)
  |-- WalkingHeartRateAverage            |-- walkingHR (月度)
  |                                      |-- hrHourly (24小时分布)
  |
  |-- SleepAnalysis                   --> sleep.json
  |     核心 / 深睡 / REM / 清醒         |-- nightly (每晚分解)
  |                                      |-- monthly (月均)
  |                                      |-- heatmap (入睡分布)
  |                                      |-- breathingDisturbances
  |                                      |-- wristTemperature
  |
  |-- StepCount                      --> activity.json
  |-- ActiveEnergyBurned                 |-- steps (每日 + 月度)
  |-- Workout (游泳, 骑行...)            |-- workouts (含心率统计)
  |-- BodyMass / BodyFatPercentage       |-- bodyMass / bodyFat
  |-- AppleExerciseTime                  |-- exerciseTime
  |
  |-- Electrocardiograms (CSV)        --> ecg.json
  |     512Hz Lead I 记录                |-- 降采样波形
  |
  +-- 计算字段                       --> overview.json
        |-- healthScore (每日 0-100, 6个维度)
        |-- longevityScore (0-100, 7个循证维度)
        |-- risks (6个维度, 动态计算)
        |-- goals (个性化目标)
        |-- baselines (30天滚动均值/标准差)
        |-- anomalies (5种类型: RHR, HRV, 睡眠, 入睡, SpO2)
```

## 快速开始

### 方式一：Web 仪表盘（最简单）

```bash
git clone https://github.com/derekyu8090/quantself.git
cd quantself
npm install

# 处理 Apple Health 数据
python3 process_data.py /path/to/apple_health_export

# 启动仪表盘
npm run dev
```

浏览器打开 http://localhost:5173

### 方式二：macOS 桌面应用

需要 Rust 工具链（`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`）。

```bash
# 构建原生应用
npx tauri build

# 安装到应用程序
cp -r src-tauri/target/release/bundle/macos/QuantSelf.app /Applications/
```

### 方式三：iCloud 自动同步

```bash
brew install fswatch

# 安装后台监听服务
cp scripts/com.quantself.watcher.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.quantself.watcher.plist
```

之后在 iPhone 上：健康 > 头像 > 导出所有健康数据 > 保存到 iCloud Drive 的 `HealthExport` 文件夹。Mac 自动检测并更新。

## 更新数据

```bash
python3 process_data.py /path/to/new_apple_health_export
```

如果安装了 Claude Code 的 skill：

```
/health-update /path/to/apple_health_export
```

## 项目结构

```
quantself/
  process_data.py                  # 数据管线 (XML -> JSON, 无依赖)
  public/data/                     # 生成的健康数据 (gitignored)
  scripts/
    health-watcher.sh              # iCloud 自动同步守护进程
    com.quantself.watcher.plist    # launchd 服务配置
  src/
    App.jsx                        # 主框架 (标签页, 主题, 语言, 数据加载)
    i18n.js                        # 中/英文翻译
    chartTheme.js                  # Recharts 主题 (适配日/夜模式)
    index.css                      # 设计令牌
    print.css                      # PDF 导出样式
    utils/
      dataUtils.js                 # 通用日期/统计工具
    contexts/
      DateRangeContext.jsx          # 全局日期范围筛选
    components/
      CardiovascularPanel.jsx      # 心率, HRV, VO2Max, 血氧, 呼吸频率
      SleepPanel.jsx               # 睡眠阶段, 入睡时间, 呼吸障碍, 温度
      ActivityPanel.jsx            # 步数, 运动, 锻炼时长, 成就
      RiskPanel.jsx                # 风险评分, 目标, 异常事件
      ComparisonView.jsx           # 时间段对比
      ECGPanel.jsx                 # 心电图波形查看器
      GlossaryPanel.jsx            # 指标说明
      HealthScoreCard.jsx          # 每日健康评分仪表盘
      LongevityScoreCard.jsx       # 长期评分（含参考文献）
      BaselineAlerts.jsx           # 基线偏离告警
      ExerciseRecoveryChart.jsx    # 运动恢复分析
      CalendarHeatmap.jsx          # GitHub 风格热力图
      AchievementBadges.jsx        # 连续天数与记录
      StatCard.jsx                 # 通用指标卡片
      ChartTooltip.jsx             # 通用图表提示框
      DateRangePicker.jsx          # 时间范围选择器
  src-tauri/                        # Tauri 桌面应用 (Rust)
    src/lib.rs                     # 系统托盘, 窗口管理
    tauri.conf.json                # 应用配置, 打包
```

## 路线图

### 已完成

- [x] **v1.0** — 核心仪表盘：5面板 + 日/夜模式 + 中/英文
- [x] **v1.1** — 日期范围筛选 + 6个新图表 + 动态风险评分 + 5类异常检测
- [x] **v1.2** — 每日健康评分 + 基线告警 + 时间段对比 + 运动恢复分析
- [x] **v1.3** — 循证长期评分 + 日历热力图 + 心电图 + 成就系统 + PDF导出
- [x] **v1.4** — Tauri macOS 桌面应用 (12MB) + iCloud fswatch 自动同步
- [x] **v1.5** — 11 个新 Apple Health 指标（日光暴露、步态分析、耳机音量等）+ Arboleaf 体脂秤接入（13 项身体成分指标）
- [x] **v1.6** — 相关性发现引擎（11 对显著相关）、日光暴露纳入长期评分、8 维风险评估（听力 + 步态）、步行稳定性 + 六分钟步行测试图表
- [x] **v1.7** — AI 周报（Claude API，中英双语）、日光暴露纳入每日评分、Arboleaf 内脏脂肪/骨骼肌率纳入风险计算

### 计划中

- [ ] **v2.0** — iOS 应用（Capacitor + HealthKit 直接读取）、多源支持（Garmin、Fitbit）

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 19 + Recharts 3 | 交互式图表和 UI |
| 样式 | CSS Variables | 日/夜主题，无 CSS 框架 |
| 构建 | Vite 8 | 快速 HMR 开发 |
| 桌面 | Tauri 2.10 (Rust) | 原生 macOS 应用，12MB 包体 |
| 数据管线 | Python (标准库) | 流式 XML 解析，无依赖 |
| 自动同步 | fswatch + launchd | 后台文件监听 |

## 隐私

- 所有数据留在你的设备上。无云端、无遥测、无外部 API 调用。
- `public/data/*.json` 已 gitignore——你的健康数据永远不会被提交。
- Tauri 应用使用系统 WebView——不捆绑 Chromium，不采集数据。

## 数据管线性能

| 导出大小 | 记录数 | 处理时间 (M3 Max) |
|----------|--------|-------------------|
| 500 MB | ~150万 | ~1 分钟 |
| 1.2 GB | ~300万 | ~2 分钟 |
| 2 GB+ | ~500万 | ~3-4 分钟 |

## 参与贡献

欢迎贡献。查看[路线图](#路线图)了解计划中的功能。重点方向：

- **数据源适配器** — Garmin、Fitbit、Samsung Health 解析器
- **新可视化** — 相关性发现、预测模型
- **移动端** — Capacitor iOS/Android + HealthKit/Health Connect
- **本地化** — 更多语言支持

## 参考文献

长期健康评分的方法学基于以下同行评审研究：

1. Kodama S et al. Cardiorespiratory fitness as a quantitative predictor of all-cause mortality. *JAMA*. 2009;301(19):2024-2035.
2. Mandsager K et al. Association of CRF with long-term mortality. *JAMA Netw Open*. 2018;1(6):e183605.
3. Windred DP et al. Sleep regularity is a stronger predictor of mortality risk than sleep duration. *Sleep*. 2024;47(1):zsad253.
4. Paluch AE et al. Daily steps and all-cause mortality: a meta-analysis. *Lancet Public Health*. 2022;7(3):e219-e228.
5. Hillebrand S et al. Heart rate variability and first cardiovascular event. *Europace*. 2013;15(5):742-749.
6. Jayedi A et al. Body fat and risk of all-cause mortality. *Int J Obes*. 2022;46(9):1573-1581.
7. Yan B et al. Nocturnal oxygen saturation and all-cause mortality. *J Clin Sleep Med*. 2024;20(2):229-235.
8. Lloyd-Jones DM et al. Life's Essential 8. *Circulation*. 2022;146(5):e18-e43.

## 许可证

MIT
