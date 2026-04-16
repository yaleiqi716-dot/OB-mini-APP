// Part of OrangeBench product internal design system
import { FileText, Presentation, Mail, ImageIcon, Send } from "lucide-react";

const CARDS = [
  { icon: FileText, title: "写一份方案", desc: "商业计划、产品方案、项目报告" },
  { icon: Presentation, title: "生成 PPT", desc: "自动生成演示文稿" },
  { icon: Mail, title: "写邮件", desc: "商务邮件、跟进邮件、道歉信" },
  { icon: ImageIcon, title: "生成图片", desc: "AI 图像生成" },
];

export function AgentWelcomeScreen() {
  return (
    <div className="flex flex-1 flex-col items-center px-6" style={{ paddingTop: "15vh" }}>
      <h1 className="mb-2 text-3xl font-semibold text-[#F5F5F4]">
        今天想做什么？
      </h1>
      <p className="mb-10 text-sm text-text-muted">
        从下面选一个开始，或直接输入你的想法
      </p>

      {/* Action cards */}
      <div className="grid w-full max-w-2xl grid-cols-2 gap-3">
        {CARDS.map((card) => (
          <button
            key={card.title}
            className="focus-ring flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4 text-left transition-all duration-base hover:border-border-strong hover:bg-surface-raised"
          >
            <card.icon size={20} className="text-primary" />
            <span className="text-sm font-medium text-[#F5F5F4]">{card.title}</span>
            <span className="text-xs text-text-muted">{card.desc}</span>
          </button>
        ))}
      </div>

      {/* Input placeholder */}
      <div className="mt-8 mb-12 flex w-full max-w-3xl items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-3 transition-colors duration-fast focus-within:border-border-strong" style={{ minHeight: 56 }}>
        <input
          type="text"
          readOnly
          placeholder="描述你想完成的任务..."
          className="flex-1 bg-transparent text-sm text-[#F5F5F4] placeholder:text-text-subtle outline-none cursor-default"
        />
        <button className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-[#F5F5F4] transition-colors duration-fast hover:bg-accent-hover">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
