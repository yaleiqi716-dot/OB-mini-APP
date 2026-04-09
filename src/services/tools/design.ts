import { spawn } from 'child_process';
import { join } from 'path';
import { mkdir, access, stat } from 'fs/promises';
import { randomUUID } from 'crypto';
import { homedir } from 'os';

// gstack design binary integration.
// Shells out to the prebuilt binary at ~/.claude/skills/gstack/design/dist/design
// and returns a server-accessible URL for the generated PNG.
//
// Binary docs: `design generate --brief "..." --output /path.png`
// Runtime:     10-40 seconds depending on provider
// Required:    OPENAI_API_KEY env var (binary reads from env or ~/.gstack/openai.json)
// See:         src/app/api/designs/[filename]/route.ts for the serving side

const GENERATED_DIR = join(process.cwd(), 'generated');
// Max time we'll wait for the binary. Anything over this and we kill it.
// Generation typically takes 15-30s; 90s gives headroom without holding
// the worker hostage.
const GENERATION_TIMEOUT_MS = 90_000;

export interface DesignGenerateResult {
  success: boolean;
  imageUrl?: string;   // server-relative URL, e.g. '/api/designs/<uuid>.png'
  imagePath?: string;  // absolute filesystem path (for debugging / cleanup)
  error?: string;
  errorCode?: string;  // bucketed: 'no_binary' | 'no_key' | 'timeout' | 'provider_error' | 'unknown'
}

// Resolve the design binary path. Checks env override first, then the
// standard gstack install location under the user's home dir. Returns
// null if no binary is found — callers should surface a setup message.
async function resolveBinary(): Promise<string | null> {
  const envOverride = process.env.GSTACK_DESIGN_BINARY;
  if (envOverride) {
    try {
      await access(envOverride);
      return envOverride;
    } catch {
      // fall through to default
    }
  }
  const defaultPath = join(homedir(), '.claude', 'skills', 'gstack', 'design', 'dist', 'design');
  try {
    await access(defaultPath);
    return defaultPath;
  } catch {
    return null;
  }
}

// Classify binary stderr into a bucketed error code so the dispatcher can
// return an actionable message to the user.
function classifyError(stderr: string): { code: string; message: string } {
  const s = stderr.toLowerCase();
  if (s.includes('no openai api key') || s.includes('invalid api key') || s.includes('401')) {
    return {
      code: 'no_key',
      message: 'AI 图像生成服务未配置 (缺少 OpenAI API key)。请联系管理员启用。',
    };
  }
  if (s.includes('rate limit') || s.includes('429')) {
    return {
      code: 'rate_limited',
      message: 'AI 图像生成服务当前繁忙,请 30 秒后重试。',
    };
  }
  if (s.includes('content policy') || s.includes('safety') || s.includes('moderation')) {
    return {
      code: 'content_policy',
      message: '该内容无法生成图像 (触发安全策略)。请换个描述再试。',
    };
  }
  if (s.includes('unable to connect') || s.includes('econnrefused') || s.includes('timeout')) {
    return {
      code: 'network',
      message: '连不上 AI 图像生成服务,请稍后重试。',
    };
  }
  return {
    code: 'provider_error',
    message: stderr.trim().slice(0, 200) || '图像生成失败,请稍后重试。',
  };
}

// Generate a single image from a design brief.
// Non-throwing — returns a structured result even on failure so callers
// can render a clean error card without try/catch gymnastics.
export async function generateDesignImage(brief: string): Promise<DesignGenerateResult> {
  if (!brief || !brief.trim()) {
    return { success: false, error: '缺少生成描述', errorCode: 'invalid_input' };
  }

  const binary = await resolveBinary();
  if (!binary) {
    return {
      success: false,
      error:
        'gstack design 工具未安装。请在服务器上运行 `~/.claude/skills/gstack/design/setup` 后重试。',
      errorCode: 'no_binary',
    };
  }

  // Ensure output directory exists.
  await mkdir(GENERATED_DIR, { recursive: true });
  const filename = `${randomUUID()}.png`;
  const outputPath = join(GENERATED_DIR, filename);

  return new Promise(resolve => {
    const child = spawn(
      binary,
      ['generate', '--brief', brief.trim(), '--output', outputPath],
      {
        env: { ...process.env }, // inherit OPENAI_API_KEY
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stderr = '';
    let stdout = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    // Timeout guard — kill the process if generation takes too long.
    const timeoutHandle = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // already dead
      }
    }, GENERATION_TIMEOUT_MS);

    child.on('error', err => {
      clearTimeout(timeoutHandle);
      resolve({
        success: false,
        error: `无法启动 gstack design 二进制: ${err.message}`,
        errorCode: 'spawn_error',
      });
    });

    child.on('close', async exitCode => {
      clearTimeout(timeoutHandle);

      if (exitCode !== 0) {
        const { code, message } = classifyError(stderr || stdout);
        resolve({ success: false, error: message, errorCode: code });
        return;
      }

      // Success — verify the output file exists and is non-empty.
      try {
        const st = await stat(outputPath);
        if (!st.isFile() || st.size === 0) {
          resolve({
            success: false,
            error: '图像文件未生成,请重试',
            errorCode: 'empty_output',
          });
          return;
        }
      } catch {
        resolve({
          success: false,
          error: '图像文件未生成,请重试',
          errorCode: 'missing_output',
        });
        return;
      }

      resolve({
        success: true,
        imageUrl: `/api/designs/${filename}`,
        imagePath: outputPath,
      });
    });
  });
}
