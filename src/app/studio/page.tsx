'use client';

import { useMemo, useState } from 'react';
import { getMessages } from '@/lib/i18n';
import { ProductShell, Panel, SegmentControl, ActionChip, EmptyState, StatusPill } from '@/components/product-shell/ProductShell';

const t = getMessages('zh-CN');

type StudioMode = 'create' | 'canvas' | 'edit' | 'motion' | 'templates';

const MODE_OPTIONS: { value: StudioMode; label: string }[] = [
  { value: 'create', label: t.studio.modes.create },
  { value: 'canvas', label: t.studio.modes.canvas },
  { value: 'edit', label: t.studio.modes.edit },
  { value: 'motion', label: t.studio.modes.motion },
  { value: 'templates', label: t.studio.modes.templates },
];

function StudioMain({ mode }: { mode: StudioMode }) {
  if (mode === 'create') {
    return (
      <div className="ob-studio-main-grid">
        <Panel title="创作输入" description="输入需求并触发生成任务">
          <textarea className="ob-studio-textarea" placeholder="输入你的创作目标、风格要求、输出尺寸与场景..." />
          <div className="ob-studio-actions-row">
            <ActionChip>开始生成</ActionChip>
            <ActionChip>{t.common.reuseLastPrompt}</ActionChip>
          </div>
        </Panel>
        <Panel title="当前任务状态" description={t.common.workspaceStatus}>
          <StatusPill>{t.common.ready}</StatusPill>
          <p className="ob-panel-hint">可在创作台开始生成，后续可接入真实生图 / 生视频执行流。</p>
        </Panel>
      </div>
    );
  }

  if (mode === 'canvas') {
    return (
      <div className="ob-studio-main-grid">
        <Panel title="画布区" description="单页画布编辑">
          <div className="ob-studio-canvas">画布视图挂载位</div>
        </Panel>
        <Panel title="画布工具" description="图层 / 对齐 / 吸附">
          <div className="ob-chip-row">
            <ActionChip>添加文字</ActionChip>
            <ActionChip>添加图层</ActionChip>
            <ActionChip>对齐参考线</ActionChip>
          </div>
        </Panel>
      </div>
    );
  }

  if (mode === 'edit') {
    return (
      <div className="ob-studio-main-grid">
        <Panel title="素材预览" description="当前焦点">
          <div className="ob-studio-canvas">素材预览区</div>
        </Panel>
        <Panel title="编辑面板" description="裁剪 / 调色 / 文案">
          <div className="ob-chip-row">
            <ActionChip>裁剪比例</ActionChip>
            <ActionChip>颜色校正</ActionChip>
            <ActionChip>文案替换</ActionChip>
          </div>
        </Panel>
      </div>
    );
  }

  if (mode === 'motion') {
    return (
      <div className="ob-studio-main-grid">
        <Panel title="源素材与预览" description="动效时间轴">
          <div className="ob-studio-canvas">动效预览窗口</div>
        </Panel>
        <Panel title="动效参数" description="速度 / 过渡 / 强度">
          <div className="ob-chip-row">
            <ActionChip>基础转场</ActionChip>
            <ActionChip>关键帧速度</ActionChip>
            <ActionChip>循环设置</ActionChip>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <Panel title="模板库" description="官方模板与团队模板">
      <div className="ob-template-grid">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} className="ob-template-card">模板 #{n}</button>
        ))}
      </div>
    </Panel>
  );
}

export default function StudioPage() {
  const [mode, setMode] = useState<StudioMode>('create');

  const modeLabel = useMemo(() => MODE_OPTIONS.find((m) => m.value === mode)?.label || t.studio.modes.create, [mode]);

  return (
    <ProductShell
      hero={
        <div>
          <h1>{t.studio.title}</h1>
          <p>{t.common.singlePageMode} · {modeLabel} · {t.common.readyInStudio}</p>
        </div>
      }
      rightRail={
        <div className="ob-grid-gap">
          <Panel title={t.studio.panels.style} description={t.common.focusAsset}>
            <StatusPill>{t.common.workspaceStatus}: {t.common.ready}</StatusPill>
            <div className="ob-chip-row">
              <ActionChip>品牌风格</ActionChip>
              <ActionChip>视觉风格</ActionChip>
            </div>
          </Panel>
          <Panel title={t.studio.panels.advanced} description="生成参数面板">
            <div className="ob-chip-row">
              <ActionChip>尺寸与比例</ActionChip>
              <ActionChip>质量与速度</ActionChip>
              <ActionChip>随机种子</ActionChip>
            </div>
          </Panel>
          <Panel title={t.studio.panels.context} description={t.common.dropRefImages}>
            <EmptyState title="暂无参考素材" description={t.common.dropRefImages} />
          </Panel>
          <Panel title={t.studio.panels.actions} description="任务操作快捷入口">
            <div className="ob-chip-row">
              <ActionChip>{t.common.openQueue}</ActionChip>
              <ActionChip>{t.common.saveAsTemplate}</ActionChip>
            </div>
          </Panel>
        </div>
      }
    >
      <div className="ob-grid-gap">
        <SegmentControl value={mode} onChange={(value) => setMode(value as StudioMode)} options={MODE_OPTIONS} />
        <StudioMain mode={mode} />
        <Panel title={t.studio.panels.drawer} description={`${t.studio.panels.recent} / ${t.studio.modes.templates} / ${t.studio.panels.inspiration} / 队列`}>
          <div className="ob-bottom-drawer">{t.studio.panels.recent} · {t.studio.modes.templates} · {t.studio.panels.inspiration} · 队列</div>
        </Panel>
      </div>
    </ProductShell>
  );
}
