# OrangeBench Frontend Rules

> Day 2 开始重写 /agent，改动前必须确认 /agent-legacy 仍可用。

## Product Positioning
- Desktop-first product, minimum supported width 1024px
- 落地页：desktop-first, mobile 保持可读即可
- 产品内部页面：desktop-only, 小屏显示 DesktopGate 提示

## Stack
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- tRPC (backend 已存在，不要改)
- Framer Motion 用于动效

## Brand Colors (必须用 CSS 变量，禁止硬编码)
- Primary: #FF5A1F
- Background: #0C0C0A
- Surface: #111110
- Border: #1F1F1D
- Text Primary: #F5F5F4
- Text Muted: #A8A29E

## Theme
- Dark theme only
- 所有组件默认深色

## File Structure
- components/landing/  → 落地页组件
- components/product/  → 产品内部组件
- components/layout/   → 布局组件（含 DesktopGate）
- components/ui/       → shadcn 基础组件

## Responsive Strategy
- 落地页：desktop-first，mobile 能阅读即可
- 产品内部：desktop-only (1024px+)
  - 小于 1024px 显示 DesktopGate 遮罩
  - 用户可点 "Continue anyway" 关闭（localStorage 记住）
- 设计断点：
  - 最小支持：1024px
  - 主要优化：1280px（笔记本）和 1536px（大屏）
  - sm/md/lg 不作为产品内部主要断点

## Rules
- 所有组件 TypeScript
- 禁止 emoji
- 圆角统一用 rounded-lg (8px)
- 间距用 4 的倍数
- 动效时长统一 150ms 或 300ms
- 集成 21st.dev 组件时，保留原有业务逻辑不动
- 禁止 text-white / bg-white / text-black / bg-black，使用设计系统色
  - 唯一例外：橙色背景上的 CTA 按钮可用 text-white 保证对比度

## Product Internal Design Rules

### Layout
- App shell: 左侧 Sidebar (240px 展开 / 56px 折叠) + 右侧 Content
- Content 内部最大宽度不限，按需决定
- 内容区域默认 padding: 24px（紧凑型 16px）

### Density
- 产品内部默认紧凑型（Linear 风），不是舒适型（Notion 风）
- 列表行高 32-40px
- 按钮默认 h-8 (32px) 或 h-9 (36px)，不用 h-10
- 字号主体 text-sm，标题 text-base 或 text-lg

### Surfaces (层级)
- background: 页面底层
- surface: 卡片、侧栏
- surface-raised: 卡片 hover、弹出层
- surface-overlay: hover 状态
- 不要超过 3 层嵌套

### Icons
- 统一 lucide-react
- 默认 size={16}，次要 size={14}，强调 size={18}
- 禁止混用其他图标库

### Loading & Empty States
- 加载：用 Skeleton，禁止 spinner（Linear 从不用 spinner）
- 空状态：图标 + 一句话 + CTA，不要大段解释
- 错误：红色边框 + 简短错误信息 + 重试按钮

### Data Display
- 列表：Linear 风格紧凑列表，hover 整行变色
- 表格：尽量用列表代替，真要用表再做 Table
- 表单：单列，label 在输入框上方或左侧，不要浮动 label

### Feedback
- Toast 用 sonner，位置 bottom-right，duration 3000ms
- 确认对话框用 shadcn AlertDialog，不用 window.confirm
- 破坏性操作（删除）必须二次确认，按钮红色

### Animations
- 默认 150ms ease-smooth
- 禁止弹簧动效（bouncy）
- 禁止 > 300ms 的动画
- Framer Motion 仅用于布局切换和进入离开

### Don'ts
- 不用渐变色（除了品牌橙可少量用作强调）
- 不用阴影堆叠（最多 1 层阴影）
- 不用 emoji
- 不用圆形头像之外的圆形元素
- 不在产品内部用大字号（> text-2xl）
