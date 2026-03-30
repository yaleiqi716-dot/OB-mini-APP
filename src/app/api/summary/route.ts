import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chatCompletion } from '@/lib/openrouter';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [completed, pending, failed, blocked] = await Promise.all([
      prisma.task.count({ where: { status: 'completed', updatedAt: { gte: today } } }),
      prisma.task.count({ where: { status: { in: ['queued', 'understanding', 'structuring', 'executing', 'interacting'] } } }),
      prisma.task.count({ where: { status: 'failed', updatedAt: { gte: today } } }),
      prisma.task.count({ where: { status: 'blocked' } }),
    ]);

    // Get recent completed tasks for highlights
    const recentCompleted = await prisma.task.findMany({
      where: { status: 'completed', updatedAt: { gte: today } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { title: true, type: true },
    });

    const highlights = recentCompleted.map((t) => t.title || `${t.type} 任务`);

    // Issues
    const issues: string[] = [];
    if (failed > 0) issues.push(`${failed} 个任务执行失败`);
    if (blocked > 0) issues.push(`${blocked} 个任务因余额不足暂停`);

    // AI suggestions (lightweight, cached-style)
    let aiSuggestions: string[] = [];
    try {
      const ctx = `今日完成 ${completed} 个任务，待处理 ${pending} 个，失败 ${failed} 个，暂停 ${blocked} 个。最近完成：${highlights.join('、')}`;
      const result = await chatCompletion(
        [
          { role: 'system', content: '你是企业工作效率顾问。根据今日数据给出 2-3 条简短建议（每条不超过15字）。只返回JSON：{"suggestions":["建议1","建议2"]}' },
          { role: 'user', content: ctx },
        ],
        { temperature: 0.3, jsonMode: true, maxTokens: 256 }
      );
      const parsed = JSON.parse(result.content);
      aiSuggestions = parsed.suggestions || [];
    } catch {
      aiSuggestions = ['建议关注失败任务', '可以尝试批量处理邮件'];
    }

    // Revenue stats
    const totalCost = await prisma.task.aggregate({
      where: { updatedAt: { gte: today } },
      _sum: { cost: true },
    });

    return NextResponse.json({
      tasksCompleted: completed,
      tasksPending: pending,
      tasksFailed: failed,
      tasksBlocked: blocked,
      creditsConsumed: totalCost._sum.cost || 0,
      highlights,
      issues,
      aiSuggestions,
    });
  } catch (error) {
    console.error('[SUMMARY_ERROR]', error);
    return NextResponse.json({ error: '获取摘要失败' }, { status: 500 });
  }
}
