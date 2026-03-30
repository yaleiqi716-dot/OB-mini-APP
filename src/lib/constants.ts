import { TaskType, TaskStatus } from '@/types/task';

export const TASK_TYPES: { value: TaskType; label: string; icon: string }[] = [
  { value: 'ppt', label: '演示文稿', icon: '📊' },
  { value: 'website', label: '网站页面', icon: '🌐' },
  { value: 'video', label: '视频脚本', icon: '🎬' },
  { value: 'email', label: '邮件撰写', icon: '✉️' },
  { value: 'proposal', label: '方案策划', icon: '📋' },
];

// 与 TaskStatus 类型定义、prisma/schema.prisma 注释保持一致
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '等待中',
  queued: '排队中',
  understanding: '理解中',
  structuring: '生成结构',
  interacting: '交互中',
  executing: '执行中',
  blocked: '等待充值',
  completed: '已完成',
  failed: '失败',
};

export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['queued', 'understanding', 'structuring', 'executing', 'failed'],
  queued: ['understanding', 'blocked', 'failed'],
  understanding: ['structuring', 'interacting', 'executing', 'blocked', 'failed'],
  structuring: ['understanding', 'interacting', 'executing', 'failed'],
  interacting: ['understanding', 'structuring', 'executing', 'interacting', 'failed'],
  executing: ['completed', 'failed', 'interacting'],
  blocked: ['queued', 'failed'],
  completed: [],
  failed: [],
};

export const WORK_CARDS = [
  {
    type: 'ppt' as TaskType,
    title: '帮我做一份融资路演',
    description: '自动生成结构清晰、内容完整的演示文稿',
    prompt: '帮我做一份融资路演PPT',
  },
  {
    type: 'email' as TaskType,
    title: '帮我回复客户邮件',
    description: '自动撰写专业得体的商务邮件',
    prompt: '帮我回复客户，说我们下周给方案',
  },
  {
    type: 'proposal' as TaskType,
    title: '帮我写一份项目方案',
    description: '自动生成完整的策划方案，逐章撰写',
    prompt: '帮我写一份新产品上市策划方案',
  },
  {
    type: 'website' as TaskType,
    title: '帮我设计一个落地页',
    description: '自动生成网页结构和视觉方案',
    prompt: '帮我设计一个产品落地页',
  },
  {
    type: 'video' as TaskType,
    title: '帮我写一个短视频脚本',
    description: '自动生成拍摄脚本和分镜',
    prompt: '帮我写一个产品介绍短视频脚本',
  },
];
