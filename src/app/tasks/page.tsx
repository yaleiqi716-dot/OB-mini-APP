'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { NavHeader } from '@/components/NavHeader';

interface TaskItem {
  id: string;
  title: string;
  status: string;   // 唯一真实状态源
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  queued: '正在处理',
  running: 'AI执行中',
  interacting: 'AI执行中',
  completed: '已完成',
  failed: '执行失败',
};

const STATUS_COLOR: Record<string, string> = {
  queued: 'bg-amber-500/10 text-amber-400',
  running: 'bg-blue-500/10 text-blue-400',
  interacting: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
};

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tasks/mine')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      <NavHeader />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 md:px-0 py-6">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="md" /></div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-content-tertiary text-sm">暂无任务记录</div>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <a
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  className="block rounded-xl border border-border/50 bg-surface-secondary p-4 hover:bg-surface-tertiary transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-content-primary truncate">
                        {t.title || '未命名任务'}
                      </div>
                      <div className="text-xs text-content-tertiary mt-1">
                        {new Date(t.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[t.status] || 'bg-surface-tertiary text-content-tertiary'}`}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
