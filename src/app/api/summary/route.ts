import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chatCompletion } from '@/lib/openrouter';

export async function GET() {
  try {
    const [total, assigned, submitted, completed] = await Promise.all([
      prisma.task.count({ where: { assigneeId: { not: null } } }),
      prisma.task.count({ where: { businessStatus: 'assigned' } }),
      prisma.task.count({ where: { businessStatus: 'submitted' } }),
      prisma.task.count({ where: { businessStatus: 'completed' } }),
    ]);

    // Highlights: last 3 completed task titles
    const recentCompleted = await prisma.task.findMany({
      where: { businessStatus: 'completed' },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { title: true, type: true },
    });
    const highlights = recentCompleted.length > 0
      ? recentCompleted.map(t => t.title || `${t.type} 任务`)
      : ['暂无已完成任务'];

    // Risks: rule-based
    const risks: string[] = [];
    if (assigned > 3) risks.push('任务积压较多');
    if (submitted > 0) risks.push('有任务待审核');
    if (risks.length === 0) risks.push('当前无明显风险');

    // AI suggestions: feed stats + highlights + risks
    let aiSuggestions: string[] = [];
    try {
      const ctx = [
        `任务统计：共 ${total} 个，待处理 ${assigned}，待审核 ${submitted}，已完成 ${completed}。`,
        `近期完成：${highlights.join('、')}。`,
        `当前风险：${risks.join('、')}。`,
      ].join('\n');

      const result = await chatCompletion(
        [
          { role: 'system', content: '你是企业管理顾问。根据以下团队任务数据，给出2-3条具体可操作的建议（每条不超过20字）。只返回JSON：{"suggestions":["建议1","建议2"]}' },
          { role: 'user', content: ctx },
        ],
        { temperature: 0.3, jsonMode: true, maxTokens: 256 }
      );
      const parsed = JSON.parse(result.content);
      if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
        aiSuggestions = parsed.suggestions;
      }
    } catch {
      // ignore
    }
    if (aiSuggestions.length === 0) {
      aiSuggestions = submitted > 0
        ? ['优先审核已提交的任务', '跟进长期未处理的指派']
        : ['持续关注任务进度', '定期检查团队产出'];
    }

    // Paused auto-tasks count
    const pausedAutoTasks = await prisma.scheduledTask.count({ where: { enabled: false } });

    return NextResponse.json({
      total,
      assigned,
      submitted,
      completed,
      pausedAutoTasks,
      highlights,
      risks,
      aiSuggestions,
    });
  } catch (error) {
    console.error('[SUMMARY_ERROR]', error);
    return NextResponse.json({ error: '获取摘要失败' }, { status: 500 });
  }
}
