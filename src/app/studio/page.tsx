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

const MODE_DESCRIPTIONS: Record<StudioMode, string> = {
  create: t.studio.modeDescriptions.create,
  canvas: t.studio.modeDescriptions.canvas,
  edit: t.studio.modeDescriptions.edit,
  motion: t.studio.modeDescriptions.motion,
  templates: t.studio.modeDescriptions.templates,
};

function StudioMain({ mode }: { mode: StudioMode }) {
  if (mode === 'create') {
    return (
      <div className="ob-studio-workbench-grid">
        <Panel title={t.studio.create.inputTitle} description={t.studio.create.inputDesc}>
          <textarea className="ob-studio-textarea" placeholder={t.studio.create.inputPlaceholder} />
          <div className="ob-studio-actions-row">
            <ActionChip>{t.studio.create.generateBtn}</ActionChip>
            <ActionChip>{t.studio.create.refineBtn}</ActionChip>
            <ActionChip>{t.common.reuseLastPrompt}</ActionChip>
          </div>
        </Panel>
        <Panel title={t.studio.create.resultTitle} description={t.studio.create.resultDesc}>
          <StatusPill>{t.studio.create.progressLabel}: {t.common.ready}</StatusPill>
          <div className="ob-studio-result-card">
            <div className="ob-studio-result-preview">{t.studio.create.resultPlaceholder}</div>
            <p className="ob-panel-hint">{t.studio.create.statusHint}</p>
          </div>
        </Panel>
      </div>
    );
  }

  if (mode === 'canvas') {
    return (
      <div className="ob-studio-workbench-grid">
        <Panel title={t.studio.canvas.stageTitle} description={t.studio.canvas.stageDesc}>
          <div className="ob-studio-canvas">{t.studio.canvas.canvasPlaceholder}</div>
        </Panel>
        <Panel title={t.studio.canvas.toolsTitle} description={t.studio.canvas.toolsDesc}>
          <div className="ob-chip-row">
            <ActionChip>{t.studio.canvas.addText}</ActionChip>
            <ActionChip>{t.studio.canvas.addLayer}</ActionChip>
            <ActionChip>{t.studio.canvas.alignGuide}</ActionChip>
            <ActionChip>{t.studio.canvas.snapToggle}</ActionChip>
          </div>
          <p className="ob-panel-hint">{t.studio.canvas.layersHint}</p>
        </Panel>
      </div>
    );
  }

  if (mode === 'edit') {
    return (
      <div className="ob-studio-workbench-grid">
        <Panel title={t.studio.edit.previewTitle} description={t.studio.edit.previewDesc}>
          <div className="ob-studio-canvas">{t.studio.edit.previewPlaceholder}</div>
        </Panel>
        <Panel title={t.studio.edit.controlsTitle} description={t.studio.edit.controlsDesc}>
          <div className="ob-chip-row">
            <ActionChip>{t.studio.edit.cropRatio}</ActionChip>
            <ActionChip>{t.studio.edit.colorTune}</ActionChip>
            <ActionChip>{t.studio.edit.copyReplace}</ActionChip>
          </div>
          <p className="ob-panel-hint">{t.studio.edit.compareHint}</p>
        </Panel>
      </div>
    );
  }

  if (mode === 'motion') {
    return (
      <div className="ob-studio-workbench-grid">
        <Panel title={t.studio.motion.sourceTitle} description={t.studio.motion.sourceDesc}>
          <div className="ob-studio-canvas">{t.studio.motion.previewPlaceholder}</div>
        </Panel>
        <Panel title={t.studio.motion.paramsTitle} description={t.studio.motion.paramsDesc}>
          <div className="ob-chip-row">
            <ActionChip>{t.studio.motion.transition}</ActionChip>
            <ActionChip>{t.studio.motion.keyframeSpeed}</ActionChip>
            <ActionChip>{t.studio.motion.loopMode}</ActionChip>
          </div>
          <p className="ob-panel-hint">{t.studio.motion.timelineHint}</p>
        </Panel>
      </div>
    );
  }

  return (
    <Panel title={t.studio.templatesMode.libraryTitle} description={t.studio.templatesMode.libraryDesc}>
      <div className="ob-template-grid">
        {[1, 2, 3, 4, 5, 6].map((n, i) => (
          <button key={n} className="ob-template-card">
            <strong>{i < 3 ? t.studio.templatesMode.officialTemplate : t.studio.templatesMode.teamTemplate} #{n}</strong>
            <span>{t.studio.templatesMode.applyTemplate}</span>
          </button>
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
        <div className="ob-studio-hero">
          <p className="ob-studio-hero-kicker">{t.studio.heroKicker}</p>
          <h1>{t.studio.title}</h1>
          <p>{t.common.singlePageMode} · {modeLabel}</p>
          <p className="ob-studio-hero-sub">{MODE_DESCRIPTIONS[mode]} · {t.studio.heroHint}</p>
        </div>
      }
      rightRail={
        <div className="ob-grid-gap ob-studio-right-rail">
          <Panel title={t.studio.panels.style} description={t.studio.rightRail.styleDesc}>
            <StatusPill>{t.common.workspaceStatus}: {t.common.ready}</StatusPill>
            <div className="ob-chip-row">
              <ActionChip>{t.studio.rightRail.brandStyle}</ActionChip>
              <ActionChip>{t.studio.rightRail.visualStyle}</ActionChip>
              <ActionChip>{t.studio.rightRail.tonePreset}</ActionChip>
            </div>
          </Panel>
          <Panel title={t.studio.panels.advanced} description={t.studio.rightRail.advancedDesc}>
            <div className="ob-chip-row">
              <ActionChip>{t.studio.rightRail.sizeRatio}</ActionChip>
              <ActionChip>{t.studio.rightRail.qualitySpeed}</ActionChip>
              <ActionChip>{t.studio.rightRail.randomSeed}</ActionChip>
            </div>
          </Panel>
          <Panel title={t.studio.panels.context} description={t.studio.rightRail.contextDesc}>
            <EmptyState title={t.studio.rightRail.emptyRefs} description={t.common.dropRefImages} />
          </Panel>
          <Panel title={t.studio.panels.actions} description={t.studio.rightRail.actionsDesc}>
            <div className="ob-chip-row">
              <ActionChip>{t.common.openQueue}</ActionChip>
              <ActionChip>{t.common.saveAsTemplate}</ActionChip>
              <ActionChip>{t.studio.rightRail.publishDraft}</ActionChip>
            </div>
          </Panel>
        </div>
      }
    >
      <div className="ob-grid-gap ob-studio-page-stack">
        <div className="ob-studio-mode-switch">
          <SegmentControl value={mode} onChange={(value) => setMode(value as StudioMode)} options={MODE_OPTIONS} />
        </div>
        <StudioMain mode={mode} />
        <Panel title={t.studio.panels.drawer} description={t.studio.drawerDesc}>
          <div className="ob-bottom-drawer ob-studio-bottom-drawer">
            <div className="ob-chip-row">
              <ActionChip>{t.studio.panels.recent}</ActionChip>
              <ActionChip>{t.studio.modes.templates}</ActionChip>
              <ActionChip>{t.studio.panels.inspiration}</ActionChip>
              <ActionChip>{t.studio.queueLabel}</ActionChip>
            </div>
            <p className="ob-panel-hint">{t.studio.drawerHint}</p>
          </div>
        </Panel>
      </div>
    </ProductShell>
  );
}
