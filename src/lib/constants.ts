import { TaskType, TaskStatus } from '@/types/task';

export const TASK_TYPES: { value: TaskType; label: string; icon: string }[] = [
  { value: 'ppt', label: '演示文稿', icon: '📊' },
  { value: 'website', label: '网站页面', icon: '🌐' },
  { value: 'video', label: '视频脚本', icon: '🎬' },
  { value: 'email', label: '邮件撰写', icon: '✉️' },
  { value: 'proposal', label: '方案策划', icon: '📋' },
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '等待中',
  routing: '分析中',
  interacting: '交互中',
  executing: '执行中',
  completed: '已完成',
  failed: '失败',
};

export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['routing', 'failed'],
  routing: ['interacting', 'executing', 'failed'],
  interacting: ['executing', 'interacting', 'failed'],
  executing: ['completed', 'failed', 'interacting'],
  completed: [],
  failed: [],
};

export const WORK_CARDS = [
  {
    type: 'ppt' as TaskType,
    title: '制作演示文稿',
    description: '根据你的需求生成专业的演示文稿结构和内容',
    prompt: '帮我制作一份演示文稿',
  },
  {
    type: 'email' as TaskType,
    title: '撰写邮件',
    description: '根据场景快速撰写专业的商务邮件',
    prompt: '帮我写一封邮件',
  },
  {
    type: 'proposal' as TaskType,
    title: '策划方案',
    description: '根据需求生成完整的策划方案',
    prompt: '帮我写一份策划方案',
  },
  {
    type: 'website' as TaskType,
    title: '设计网页',
    description: '根据描述生成网页结构和设计方案',
    prompt: '帮我设计一个网页',
  },
  {
    type: 'video' as TaskType,
    title: '视频脚本',
    description: '根据主题生成视频拍摄脚本',
    prompt: '帮我写一个视频脚本',
  },
];
