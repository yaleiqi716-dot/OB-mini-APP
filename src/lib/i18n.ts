import { zhCN } from '@/messages/zh-CN';
import { enUS } from '@/messages/en-US';

export type Locale = 'zh-CN' | 'en-US';

const registry = {
  'zh-CN': zhCN,
  'en-US': enUS,
} as const;

export function getMessages(locale: Locale = 'zh-CN') {
  return registry[locale];
}
