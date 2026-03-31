'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';

interface TaskItem {
  id: string;
  title: string;
  businessStatus: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  assigned: '待处理',
  in_progress: '进行中',
  submitted: '已提交',
  completed: '已完成',
};

const STATUS_COLOR: Record<string, string> = {
  assigned: 'bg-amber-500/10 text-amber-400',
  in_progress: 'bg-blue-500/10 text-blue-400',
  submitted: 'bg-purple-500/10 text-purple-400',
  completed: 'bg-green-500/10 text-green-400',
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
      <header className="flex items-center justify-between px-4 md:px-6 h-11 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-accent font-semibold text-sm">ORANGE</span>
          <span className="text-content-primary font-semibold text-sm">BENCH</span>
        </div>
        <span className="text-xs text-content-tertiary">我的任务</span>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 md:px-0 py-6">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="md" /></div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-content-tertiary text-sm">暂无指派给你的任务</div>
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
                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[t.businessStatus] || 'bg-surface-tertiary text-content-tertiary'}`}>
                      {STATUS_LABEL[t.businessStatus] || t.businessStatus}
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
