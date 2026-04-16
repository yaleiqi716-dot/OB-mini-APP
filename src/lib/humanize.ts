// Extracted from agent-legacy/TaskCanvas.tsx — narrative language transforms

export function humanizeThinking(text: string): string {
  const map: [RegExp, string][] = [
    [/^正在分析.*需求.*$/, "我先帮你梳理一下需求，接下来我会把结构先搭出来"],
    [/^正在分析.*主题.*受众.*$/, "我先帮你理清主题和受众，然后我来搭演示文稿的框架"],
    [/^正在分析.*场景.*收件人.*$/, "我先了解一下邮件场景，接下来我直接帮你起草"],
    [/^正在分析.*背景.*目标.*$/, "我先理解一下项目背景，接下来我会帮你把方案框架搭出来"],
    [/^正在规划.*结构.*逻辑.*$/, "结构我先给你搭出来，我们一起看一下，如果没问题我就继续往下生成内容"],
    [/^正在规划.*框架.*章节.*$/, "方案框架我已经想好了，先给你过一下，确认后我马上开始写详细内容"],
    [/^正在拆解.*逐页.*$/, "好的，我开始逐页帮你完善内容，每完成一页我会告诉你，我会持续推进"],
    [/^正在拆解.*逐章.*$/, "好的，我开始逐章帮你撰写，每完成一个章节我会推进到下一个"],
    [/^正在组织.*结构.*措辞.*$/, "我在帮你组织邮件内容，写好后给你过目，你可以直接确认或者让我改"],
    [/^正在理解.*修改.*调整.*$/, "好的，我理解了你的调整方向，马上帮你重新来一版"],
    [/^正在重新规划.*$/, "好的，我重新帮你规划一个结构，调整好后你再看看"],
  ];
  for (const [pattern, replacement] of map) {
    if (pattern.test(text)) return replacement;
  }
  if (text.startsWith("正在")) {
    return "我" + text.replace("正在", "在帮你") + "，接下来我会继续推进";
  }
  return text;
}

export function buildThinkingStream(
  events: Array<{ type: string; data: Record<string, unknown> }>
): string | null {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const e of events) {
    if (e.type === "thinking") {
      const raw = String(e.data.text || "");
      if (raw && !seen.has(raw)) {
        seen.add(raw);
        phrases.push(humanizeThinking(raw));
      }
    }
  }
  return phrases.length > 0 ? phrases.join("  ") : null;
}
