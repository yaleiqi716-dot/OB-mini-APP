import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chatCompletion } from '@/lib/openrouter';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    const userFilter = userId ? { userId } : {};

    // 唯一真实状态源：status 字段（废弃 businessStatus）
    const [total, running, completed, failed] = await Promise.all([
      prisma.task.count({ where: userFilter }),
      prisma.task.count({ where: { ...userFilter, status: { in: ['queued', 'running', 'interacting'] } } }),
      prisma.task.count({ where: { ...userFilter, status: 'completed' } }),
      prisma.task.count({ where: { ...userFilter, status: 'failed' } }),
    ]);

    // Highlights: 最近完成的任务标题
    const recentCompleted = await prisma.task.findMany({
      where: { ...userFilter, status: 'completed' },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { title: true, type: true },
    });
    const highlights = recentCompleted.length > 0
      ? recentCompleted.map(t => t.title || `${t.type} 任务`).slice(0, 3)
      : ['暂无已完成任务'];

    // Risks: rule-based
    const risks: string[] = [];
    if (running > 3) risks.push('任务积压较多');
    if (failed > 0) risks.push(`有 ${failed} 个任务执行失败`);
    if (risks.length === 0) risks.push('当前无明显风险');

    // AI suggestions
    let aiSuggestions: string[] = [];
    try {
      const ctx = [
        `任务统计：共 ${total} 个，执行中 ${running}，已完成 ${completed}，失败 ${failed}。`,
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
      aiSuggestions = completed > 0
        ? ['持续关注任务进度', '定期检查团队产出']
        : ['发送第一个任务，开始体验 AI 执行', '尝试让 AI 帮你写邮件或做 PPT'];
    }

    const pausedAutoTasks = await prisma.scheduledTask.count({ where: { enabled: false } });

    return NextResponse.json({
      total,
      running,
      completed,
      failed,
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
