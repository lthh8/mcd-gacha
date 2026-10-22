# 麦门图鉴 · Gacha Collection 🍔🎴

> 基于**麦当劳 MCP** 的创意 Skill：把你的麦门历史订单、积分与优惠券，变成一张**可收集的二次元卡牌图鉴**。抽本命单品、攒欧气值、集齐图鉴，还能一键生成专属**分享报告卡**。

**1024 程序员节 · 麦当劳程序员创意开发大赛参赛作品**（非麦当劳官方产品，粉丝向）

---

## ✨ 这是什么

麦门信徒人手一本的「图鉴」。Skill 连接麦当劳 MCP（**只读**）后：

1. **全息闪卡图鉴** —— 把巨无霸、麦旋风、薯条、麦辣鸡腿堡等经典单品，做成带稀有度、台词与镭射工艺的收藏卡牌（立绘为纯 SVG 手绘，零生图成本）。
2. **欧气值 / 本命单品** —— 根据你的真实历史订单、积分、优惠券，推算出你的「麦门欧气值」与「本命卡」。
3. **单抽 / 十连** —— SSR 5% / SR 15% / R 35% / N 45%，十连保底至少一张 R+。
4. **图鉴收集进度** —— 收集 16/16，集齐即解锁完整图鉴；未收集的卡只显示一个大问号，不剧透。
5. **分享报告卡** —— 一键生成高颜值 PNG 报告卡，晒朋友圈 / 群聊，天然驱动传播。

> 当前仓库附带一个**纯静态可交互 Demo**（`index.html`，无需 MCP Token 即可体验抽卡/图鉴/报告卡完整流程），正式 Skill 见 `skill/SKILL.md`。

## 🎯 玩法

| 稀有度 | 掉率 | 卡牌 |
|--------|------|------|
| SSR | 5% | 巨无霸 · 麦旋风 · 安格斯厚牛堡 |
| SR | 15% | 麦辣鸡腿 · 薯条 · 板烧鸡腿 · 双层吉士 |
| R | 35% | 可乐 · 麦乐鸡 · 麦香鱼 · 甜筒 · 麦咖啡 |
| N | 45% | 苹果派 · 甜玉米 · 香草奶昔 · 猪柳蛋堡 |

- **欧气值** = (SSR×3 + SR×1.2) / 总抽数 × 100，接 MCP 后额外叠加真实订单热度权重。
- **十连保底**：至少 1 张 R 及以上。
- **分享标题**：欧皇本皇 / 麦门锦鲤 / 图鉴收藏家 / 麦门老饕 / 麦门萌新。

## 🚀 快速开始

### A. 体验 Demo（零配置）
直接用浏览器打开 `index.html`，即可体验抽卡、图鉴与报告卡生成。

### B. 安装正式 Skill（WorkBuddy）
1. 配置麦当劳 MCP（见 `mcp-config.example.json`，仅环境变量占位符）：
   ```json
   {
     "mcpServers": {
       "mcd-mcp": {
         "type": "streamablehttp",
         "url": "https://mcp.mcd.cn",
         "headers": { "Authorization": "Bearer ${MCD_MCP_TOKEN}" }
       }
     }
   }
   ```
2. 在麦当劳 MCP 控制台申请 Token，填入环境变量 `MCD_MCP_TOKEN`。
3. 在 WorkBuddy「专家·技能·连接器 → 连接器 → 自定义连接器」启用 `mcd-mcp`。
4. 加载本仓库 `skill/SKILL.md` 描述的 Skill，对话即可开抽。

## 🧩 目标用户

- 麦门信徒 / 收藏控 / 卡牌游戏爱好者
- 想低门槛体验「MCP + 前端可视化」玩法的人
- 需要可晒图传播素材的内容玩家

## 🛠 技术栈

| 层 | 方案 |
|---|---|
| 卡面 | 纯内联 SVG（径向夜空渐变 + 16 道放射光束 + 星点 + 水彩边缘扰动 `feTurbulence`），16 张立绘全部手写路径，**零 AI 生图、零积分消耗** |
| 全息工艺 | CSS `mix-blend-mode` 镭射层 + **中心遮罩**（参考 PTCG「插画区哑光、边框反光」工艺，图案永不被糊）+ 周期白光扫过 + 鼠标跟随高光 + 3D 倾斜 |
| Demo | 单文件 `index.html`，无依赖、无构建，localStorage 存档（存储被禁时自动降级为内存存档并提示） |
| MCP 客户端 | `skill/scripts/mcd-mcp-client.mjs`，Node 18+ 零依赖，JSON-RPC over Streamable HTTP，**只读工具白名单强制** |
| 分享卡 | SVG → `Image` → `Canvas` → PNG，纯前端导出 |

## 📁 目录结构

```
mcd-gacha/
├── README.md                 # 本文件
├── CONTEST_DECLARATION.md    # 官方参赛声明（内容不可改）
├── MCP_INTEGRATION.md        # 麦当劳 MCP 集成说明
├── mcp-config.example.json   # 脱敏 MCP 配置示例（仅环境变量占位）
├── workbuddy.md              # WorkBuddy 开发对话上下文（联动奖励）
├── LICENSE                   # MIT
├── index.html                # 可交互 Demo（单抽/十连/图鉴/报告卡，主入口）
├── gallery.html              # 16 张闪卡图鉴墙（稀有度筛选）
├── flashcard-demo.html       # 单卡工艺演示
├── skill/
│   ├── SKILL.md              # 正式 Skill 定义与算法
│   └── scripts/
│       └── mcd-mcp-client.mjs  # 麦当劳 MCP 只读客户端（Node 18+ 零依赖）
└── assets/
    └── cards/*.png           # 早期 AI 生成卡面样品（已被 SVG 立绘取代，保留作过程存档）
```

## 🏆 参赛信息

- **赛事**：1024 程序员节 · 麦当劳程序员创意开发大赛（WorkBuddy 联合举办）
- **官方仓库**：<https://github.com/M-China/mcd-developer-innovation-challenge>
- **作品形式**：基于麦当劳 MCP（`https://mcp.mcd.cn`）开发的 Skill，需开源发布到 GitHub
- **排名规则**：GitHub 公开 Star 数，截止 **2026-10-26 00:00**
- **提交截止**：2026-10-25 23:59
- **MCP 客户端用法**：
  ```bash
  export MCD_MCP_TOKEN=<你的Token>          # 仅环境变量，切勿提交
  node skill/scripts/mcd-mcp-client.mjs tools      # 列出 MCP 全部工具
  node skill/scripts/mcd-mcp-client.mjs luck       # 读订单算欧气值/本命卡
  node skill/scripts/mcd-mcp-client.mjs orders     # 历史订单摘要
  ```

## ⚠️ 免责声明

本项目为**粉丝向非官方作品**，与麦当劳无隶属关系；仅使用麦当劳 MCP **只读**接口，**不涉及下单、支付或任何博彩行为**，抽卡为纯娱乐。餐品信息、价格及供应状态以麦当劳官方渠道实时结果为准。
