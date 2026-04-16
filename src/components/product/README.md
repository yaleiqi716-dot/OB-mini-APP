# Product Internal Components

Atomic building blocks for OrangeBench product pages. Import from `@/components/product`.

```tsx
import { Button, Sidebar, SidebarItem, PageShell, Skeleton } from "@/components/product";
```

## Primitives (`primitives/`)

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `Button` | Compact button (h-8, text-sm) | `variant`: primary / secondary / ghost / danger, `size`: sm / md |
| `IconButton` | Icon-only button (h-8 w-8) | Standard button props |
| `Input` | Text input (h-8, text-sm) | Standard input props |
| `Textarea` | Multi-line input (min-h-20) | Standard textarea props |
| `Select` | Dropdown select (Radix) | `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` |
| `Badge` | Compact label (text-xs) | `variant`: primary / secondary / success / warning / danger |
| `Divider` | Separator line | `orientation`: horizontal / vertical |

## Layout (`layout/`)

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `Sidebar` | App sidebar shell (240px / 56px) | `collapsed` |
| `SidebarItem` | Nav item with icon + label | `active`, `icon`, `label`, `count`, `collapsed` |
| `SidebarSection` | Group heading (mono uppercase) | `label` |
| `TopBar` | Page header with breadcrumb | `title`, `breadcrumb`, `actions` |
| `PageShell` | Standard page frame | `topBar`, `aside`, `children` |

## Feedback (`feedback/`)

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `Skeleton` | Shimmer placeholder | `className` for sizing |
| `EmptyState` | Icon + title + CTA | `icon`, `title`, `description`, `action` |
| `ErrorState` | Error display + retry | `message`, `onRetry` |
| `LoadingRow` | List row placeholder | `className` |

## Overlays (`overlays/`)

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `Dialog` | Modal dialog (Radix) | `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` |
| `SlideOver` | Right slide-in panel | `SlideOverContent` |
| `Popover` | Floating popover (Radix) | `PopoverContent`, `align`, `sideOffset` |
| `ContextMenu` | Right-click menu (Radix) | `ContextMenuContent`, `ContextMenuItem` |
| `CommandPalette` | Cmd+K palette (cmdk) | `open`, `onOpenChange`, `CommandInput`, `CommandItem` |

## Data (`data/`)

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `List` | Compact list container | `children` |
| `ListItem` | List row (h-10, hover) | `selected` |
| `Avatar` | User avatar + fallback initials | `src`, `name`, `size`: sm / md / lg |
| `Tag` | Label pill with optional remove | `label`, `color`, `onRemove` |

## Design Tokens

All components use the extended design system from `tailwind.config.ts`:

- **Surfaces**: `bg-background` / `bg-surface` / `bg-surface-raised` / `bg-surface-overlay`
- **Borders**: `border-border` / `border-border-subtle` / `border-border-strong`
- **Text**: `text-text-primary` / `text-text-muted` / `text-text-subtle`
- **Accent**: `bg-primary` / `bg-accent-hover` / `bg-accent-muted`
- **Semantic**: `text-success` / `text-warning` / `text-danger` / `text-info`
- **Radius**: `rounded-xs`(4) / `rounded-sm`(6) / `rounded-md`(8) / `rounded-lg`(12) / `rounded-xl`(16)
- **Duration**: `duration-fast`(100) / `duration-base`(150) / `duration-slow`(300)
- **Easing**: `ease-smooth` = cubic-bezier(0.16, 1, 0.3, 1)
