// Part of OrangeBench product internal design system
// Barrel export — import { Button, Sidebar, ... } from "@/components/product"

// Primitives
export { Button, type ButtonProps } from "./primitives/Button";
export { IconButton } from "./primitives/IconButton";
export { Input } from "./primitives/Input";
export { Textarea } from "./primitives/Textarea";
export {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectGroup,
} from "./primitives/Select";
export { Badge, type BadgeProps } from "./primitives/Badge";
export { Divider } from "./primitives/Divider";

// Layout
export { Sidebar, type SidebarProps } from "./layout/Sidebar";
export { SidebarItem, type SidebarItemProps } from "./layout/SidebarItem";
export { SidebarSection } from "./layout/SidebarSection";
export { TopBar, type TopBarProps } from "./layout/TopBar";
export { PageShell, type PageShellProps } from "./layout/PageShell";

// Feedback
export { Skeleton } from "./feedback/Skeleton";
export { EmptyState, type EmptyStateProps } from "./feedback/EmptyState";
export { ErrorState, type ErrorStateProps } from "./feedback/ErrorState";
export { LoadingRow } from "./feedback/LoadingRow";

// Overlays
export {
  Dialog, DialogTrigger, DialogClose, DialogContent,
  DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./overlays/Dialog";
export { SlideOver, SlideOverTrigger, SlideOverClose, SlideOverContent } from "./overlays/SlideOver";
export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent } from "./overlays/Popover";
export {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator,
} from "./overlays/ContextMenu";
export {
  CommandPalette, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "./overlays/CommandPalette";

// Data
export { List } from "./data/List";
export { ListItem, type ListItemProps } from "./data/ListItem";
export { Avatar, type AvatarProps } from "./data/Avatar";
export { Tag, type TagProps } from "./data/Tag";
