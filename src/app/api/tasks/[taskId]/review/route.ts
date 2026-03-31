import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chatCompletion } from '@/lib/openrouter';
import { executeWithBilling, InsufficientCreditsError } from '@/services/billing';

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

    if (task.businessStatus !== 'submitted') {
      return NextResponse.json({ error: '只能审核已提交的任务' }, { status: 400 });
    }

    const resultRaw = task.result ? safeParseJson(task.result) : null;

    if (action === 'feedback') {
      await prisma.task.update({
        where: { id: taskId },
        data: { businessStatus: 'assigned' },
      });
      return NextResponse.json({ success: true, businessStatus: 'assigned' });
    }

    if (action === 'ai_optimize') {
      const userId = task.userId || req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value || 'demo-user';

      try {
        const optimizeResult = await executeWithBilling(userId, taskId, 'unknown', async () => {
          const content = extractContent(resultRaw);
          const fullContext = `【任务要求】\n${task.input}\n\n【员工提交】\n${content}`;
          const aiResult = await chatCompletion(
            [
              {
                role: 'system',
                content: '你是高级内容专家。请将以下内容优化为老板级品质：更专业、更精炼、更有说服力。保持原有格式和结构，只提升质量。直接输出优化后的内容。',
              },
              { role: 'user', content: fullContext },
            ],
            { temperature: 0.5, maxTokens: 4096 }
          );

          const optimizedResult = typeof resultRaw === 'object' && resultRaw !== null
            ? { ...resultRaw as Record<string, unknown>, optimized: true, optimizedContent: aiResult.content }
            : { original: resultRaw, optimized: true, optimizedContent: aiResult.content };

          await prisma.task.update({
            where: { id: taskId },
            data: {
              result: JSON.stringify(optimizedResult),
              businessStatus: 'completed',
            },
          });

          return aiResult.content;
        });

        return NextResponse.json({ success: true, businessStatus: 'completed', optimizedContent: optimizeResult });
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          return NextResponse.json({ error: err.message }, { status: 403 });
        }
        throw err;
      }
    }

    if (action === 'approve') {
      await prisma.task.update({
        where: { id: taskId },
        data: { businessStatus: 'completed' },
      });
      return NextResponse.json({ success: true, businessStatus: 'completed' });
    }

    return NextResponse.json({ error: '无效的 action' }, { status: 400 });
  } catch (error) {
    console.error('[REVIEW_ERROR]', error);
    return NextResponse.json({ error: '审核失败' }, { status: 500 });
  }
}

function safeParseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}

function extractContent(result: unknown): string {
  if (!result || typeof result !== 'object') return String(result || '');
  const r = result as Record<string, unknown>;

  if (r.type === 'email' && r.content) {
    const email = r.content as Record<string, unknown>;
    return `主题：${email.subject || ''}\n\n${email.body || ''}`;
  }
  if (r.type === 'ppt' && r.slides) {
    const slides = r.slides as { title: string; content: string[] }[];
    return slides.map((s, i) => `第${i + 1}页：${s.title}\n${(s.content || []).join('\n')}`).join('\n\n');
  }
  if (r.type === 'proposal' && r.sections) {
    const sections = r.sections as { heading: string; content: string }[];
    return sections.map((s) => `【${s.heading}】\n${s.content}`).join('\n\n');
  }
  if (r.optimizedContent) return String(r.optimizedContent);
  if (r.content) return String(r.content);
  return JSON.stringify(result).slice(0, 2000);
}
