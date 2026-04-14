import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  'text/plain', 'text/csv', 'text/markdown',
  'application/pdf',
  'application/json',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '未选择文件' }, { status: 400 });

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '文件大小超过 10MB 限制' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type) && file.type !== '') {
      return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 });
    }

    // Ensure upload dir exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate safe filename
    const ext = file.name.split('.').pop() || 'bin';
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const filename = `${randomUUID()}.${safeExt}`;
    const filepath = join(UPLOAD_DIR, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    return NextResponse.json({
      success: true,
      file: {
        id: filename,
        name: file.name,
        size: file.size,
        type: file.type,
        url: `/api/upload/${filename}`,
      },
    });
  } catch (error) {
    console.error('[UPLOAD_ERROR]', error);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
