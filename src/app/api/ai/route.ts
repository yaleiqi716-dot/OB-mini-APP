import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, ChatMessage, OpenRouterOptions } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, options } = body as {
      messages: ChatMessage[];
      options?: OpenRouterOptions;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    const result = await chatCompletion(messages, options || {});
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'AI 调用失败', detail: String(error) },
      { status: 500 }
    );
  }
}
