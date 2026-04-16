# OrangeBench Frontend Rules

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
- components/layout/   → 布局组件
- components/ui/       → shadcn 基础组件

## Rules
- 所有组件 TypeScript
- 禁止 emoji
- 圆角统一用 rounded-lg (8px)
- 间距用 4 的倍数
- 动效时长统一 150ms 或 300ms
- 集成 21st.dev 组件时，保留原有业务逻辑不动
