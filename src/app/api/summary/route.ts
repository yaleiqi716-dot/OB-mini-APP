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

    // Highlights: recently completed tasks
    const recentCompleted = await prisma.task.findMany({
      where: { businessStatus: 'completed' },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { title: true, type: true },
    });
    const highlights = recentCompleted.map(t => t.title || `${t.type} 任务`);

    // Risks
    const risks: string[] = [];
    if (assigned > 3) risks.push(`${assigned} 个任务仍未开始处理`);
    if (submitted > 2) risks.push(`${submitted} 个任务等待审核，请及时处理`);
    if (total > 0 && completed === 0) risks.push('暂无任务完成，请关注进度');

    // AI suggestions based on businessStatus stats
    let aiSuggestions: string[] = [];
    try {
      // Gather pending task titles for context
      const pendingTasks = await prisma.task.findMany({
        where: { businessStatus: { in: ['assigned', 'submitted'] } },
        take: 10,
        select: { title: true, businessStatus: true },
      });
      const pendingCtx = pendingTasks.map(t => `[${t.businessStatus}] ${t.title || '未命名'}`).join('；');

      const ctx = `团队任务：共 ${total} 个，待处理 ${assigned}，已提交待审 ${submitted}，已完成 ${completed}。未完成任务：${pendingCtx}`;
      const result = await chatCompletion(
        [
          { role: 'system', content: '你是企业管理顾问。根据任务数据给出 2-3 条简短建议（每条不超过15字）。只返回JSON：{"suggestions":["建议1","建议2"]}' },
          { role: 'user', content: ctx },
        ],
        { temperature: 0.3, jsonMode: true, maxTokens: 256 }
      );
      const parsed = JSON.parse(result.content);
      aiSuggestions = parsed.suggestions || [];
    } catch {
      aiSuggestions = ['建议及时审核已提交任务', '关注长期未处理的指派任务'];
    }

    return NextResponse.json({
      total,
      assigned,
      submitted,
      completed,
      highlights,
      risks,
      aiSuggestions,
    });
  } catch (error) {
    console.error('[SUMMARY_ERROR]', error);
    return NextResponse.json({ error: '获取摘要失败' }, { status: 500 });
  }
}
