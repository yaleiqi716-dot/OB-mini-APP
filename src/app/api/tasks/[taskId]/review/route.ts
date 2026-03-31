import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chatCompletion } from '@/lib/openrouter';
import { emitEvent, emitLog } from '@/services/task-manager';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    const body = await req.json();
    const action = body.action as string;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    if (task.status !== 'completed') {
      return NextResponse.json({ error: '只能审核已完成的任务' }, { status: 400 });
    }

    const resultRaw = task.result ? JSON.parse(task.result) : null;

    if (action === 'feedback') {
      // AI generates improvement suggestions
      const content = extractContent(resultRaw);
      const aiResult = await chatCompletion(
        [
          {
            role: 'system',
            content: '你是一个严格的审核专家。请对以下内容给出2-3条具体改进建议，每条不超过20字。只返回JSON：{"suggestions":["建议1","建议2"]}',
          },
          { role: 'user', content: `请审核：${content}` },
        ],
        { temperature: 0.3, jsonMode: true, maxTokens: 256 }
      );

      let suggestions: string[] = [];
      try {
        suggestions = JSON.parse(aiResult.content).suggestions || [];
      } catch {
        suggestions = ['建议优化整体结构', '建议补充关键数据'];
      }

      await emitEvent(taskId, 'log', { message: '审核意见已生成' });
      await emitEvent(taskId, 'interaction_request', {
        id: `review_${Date.now()}`,
        taskId,
        stepId: 'review_feedback',
        type: 'confirm',
        question: '审核建议',
        detail: suggestions.join('\n'),
        detailData: { suggestions },
      });

      return NextResponse.json({ success: true, suggestions });
    }

    if (action === 'ai_optimize') {
      // AI generates an upgraded version
      const content = extractContent(resultRaw);
      const aiResult = await chatCompletion(
        [
          {
            role: 'system',
            content: '你是高级内容专家。请将以下内容优化为老板级品质：更专业、更精炼、更有说服力。保持原有格式和结构，只提升质量。',
          },
          { role: 'user', content: content },
        ],
        { temperature: 0.5, maxTokens: 4096 }
      );

      const optimized = {
        ...resultRaw,
        optimized: true,
        optimizedContent: aiResult.content,
      };

      await prisma.task.update({
        where: { id: taskId },
        data: { result: JSON.stringify(optimized) },
      });

      await emitEvent(taskId, 'log', { message: 'AI 已完成优化' });
      await emitEvent(taskId, 'artifact', { result: optimized });

      return NextResponse.json({ success: true, optimized: true });
    }

    if (action === 'approve') {
      await emitEvent(taskId, 'log', { message: '已通过审核' });
      await emitEvent(taskId, 'approval_approved', {
        approvalType: 'review',
        reviewer: 'boss',
      });

      return NextResponse.json({ success: true, approved: true });
    }

    return NextResponse.json({ error: '无效的 action' }, { status: 400 });
  } catch (error) {
    console.error('[REVIEW_ERROR]', error);
    return NextResponse.json({ error: '审核失败' }, { status: 500 });
  }
}

function extractContent(result: Record<string, unknown> | null): string {
  if (!result) return '';
  const type = result.type as string;

  if (type === 'email' && result.content) {
    const email = result.content as Record<string, unknown>;
    return `主题：${email.subject || ''}\n\n${email.body || ''}`;
  }

  if (type === 'ppt' && result.slides) {
    const slides = result.slides as { title: string; content: string[] }[];
    return slides.map((s, i) => `第${i + 1}页：${s.title}\n${(s.content || []).join('\n')}`).join('\n\n');
  }

  if (type === 'proposal' && result.sections) {
    const sections = result.sections as { heading: string; content: string }[];
    return sections.map((s) => `【${s.heading}】\n${s.content}`).join('\n\n');
  }

  if (result.content) return String(result.content);
  return JSON.stringify(result).slice(0, 2000);
}
