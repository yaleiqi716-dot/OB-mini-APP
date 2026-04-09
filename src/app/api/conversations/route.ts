import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/conversations — 获取当前用户的会话列表
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        tasks: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, input: true, title: true, createdAt: true },
        },
      },
    });

    return NextResponse.json(
      conversations.map((conv) => ({
        id: conv.id,
        title: conv.title || conv.tasks[0]?.input?.slice(0, 40) || '新对话',
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        firstTaskInput: conv.tasks[0]?.input || '',
        skillRoleId: conv.skillRoleId,
      }))
    );
  } catch (error) {
    console.error('[CONVERSATIONS_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取会话列表失败' }, { status: 500 });
  }
}

// POST /api/conversations — 创建新会话
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title: string | undefined = body.title;

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: title || null,
      },
    });

    return NextResponse.json({
      id: conversation.id,
      title: conversation.title || '新对话',
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error('[CONVERSATIONS_CREATE_ERROR]', error);
    return NextResponse.json({ error: '创建会话失败' }, { status: 500 });
  }
}
