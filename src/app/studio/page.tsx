'use client';

import { useMemo, useState } from 'react';
import { getMessages } from '@/lib/i18n';
import { ProductShell, Panel, SegmentControl, ActionChip, EmptyState, StatusPill } from '@/components/product-shell/ProductShell';

const t = getMessages('zh-CN');

type StudioMode = 'create' | 'canvas' | 'edit' | 'motion' | 'templates';
type CreateFlowStatus = 'pending' | 'generating' | 'success' | 'empty' | 'error';

interface StudioTaskRecord {
  id: string;
  prompt: string;
  status: CreateFlowStatus;
  results: string[];
  message: string;
}

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
  const [prompt, setPrompt] = useState('');
  const [tasks, setTasks] = useState<StudioTaskRecord[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;
  const statusText = activeTask ? t.studio.create.states[activeTask.status] : t.studio.create.states.pending;
  const statusHint = activeTask?.message || t.studio.create.mockHint;

  function updateTask(taskId: string, patch: Partial<StudioTaskRecord>) {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  }

  function runGeneration(nextPrompt: string, existingTaskId?: string) {
    const normalized = nextPrompt.trim().toLowerCase();
    const taskId = existingTaskId || `studio-task-${Date.now()}`;
    const isRetry = !!existingTaskId;
    const baseTask: StudioTaskRecord = {
      id: taskId,
      prompt: nextPrompt,
      status: 'pending',
      results: [],
      message: t.studio.create.flowQueued,
    };

    setPrompt(nextPrompt);
    setActiveTaskId(taskId);
    setTasks((prev) => {
      if (isRetry) {
        return prev.map((task) => (task.id === taskId ? baseTask : task));
      }
      return [baseTask, ...prev].slice(0, 8);
    });

    window.setTimeout(() => {
      updateTask(taskId, { status: 'generating', message: t.studio.create.flowRunning });
    }, 300);

    window.setTimeout(() => {
      if (!normalized) {
        updateTask(taskId, {
          status: 'error',
          results: [],
          message: t.studio.create.flowNeedInput,
        });
        return;
      }

      if (normalized.includes('空')) {
        updateTask(taskId, {
          status: 'empty',
          results: [],
          message: t.studio.create.flowNoResult,
        });
        return;
      }

      if (normalized.includes('失败') || normalized.includes('error')) {
        updateTask(taskId, {
          status: 'error',
          results: [],
          message: t.studio.create.flowFailed,
        });
        return;
      }

      updateTask(taskId, {
        status: 'success',
        results: [
          `方案 A：强调「${nextPrompt.slice(0, 18)}」的主视觉版本`,
          '方案 B：强调信息层级与品牌识别的一致版本',
        ],
        message: t.studio.create.flowCompleted,
      });
    }, 1400);
  }

  function handlePrimaryGenerate() {
    runGeneration(prompt);
  }

  function handleReusePrompt() {
    const reused = activeTask?.prompt || prompt;
    setPrompt(reused);
    runGeneration(reused);
  }

  function handleRetryCurrentTask() {
    if (activeTask) {
      runGeneration(activeTask.prompt, activeTask.id);
      return;
    }
    runGeneration(prompt);
  }

  if (mode === 'create') {
    return (
      <div className="ob-studio-workbench-grid">
        <Panel title={t.studio.create.inputTitle} description={t.studio.create.inputDesc}>
          <textarea
            className="ob-studio-textarea"
            placeholder={t.studio.create.inputPlaceholder}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="ob-studio-actions-row">
            <ActionChip onClick={handlePrimaryGenerate}>{t.studio.create.primaryAction}</ActionChip>
            <ActionChip onClick={handleReusePrompt}>{t.studio.create.secondaryAction}</ActionChip>
          </div>
        </Panel>
        <Panel title={t.studio.create.resultTitle} description={t.studio.create.resultDesc}>
          <StatusPill>{t.studio.create.statusLabel}: {statusText}</StatusPill>
          <p className="ob-panel-hint">{statusHint}</p>
          {activeTask ? <p className="ob-panel-hint">{t.studio.create.latestTask}: {activeTask.id}</p> : null}
          <div className="ob-control-buttons">
            <button className="ob-outline-btn" onClick={handleRetryCurrentTask}>{t.studio.create.retry}</button>
            <button className="ob-outline-btn" onClick={handleReusePrompt}>{t.studio.create.regenerate}</button>
          </div>
        </Panel>
        <Panel title={t.studio.create.resultTitle} description={t.studio.create.resultDescription}>
          {!activeTask ? (
            <EmptyState title={t.studio.create.emptyTitle} description={t.studio.create.noTasks} />
          ) : activeTask.status === 'pending' || activeTask.status === 'generating' ? (
            <div className="ob-studio-result-placeholder">{t.studio.create.loading}</div>
          ) : activeTask.status === 'success' && activeTask.results.length > 0 ? (
            <div className="ob-studio-result-list">
              {activeTask.results.map((item) => (
                <article key={item} className="ob-studio-result-card">
                  <strong>{t.studio.create.resultItemTitle}</strong>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          ) : activeTask.status === 'error' ? (
            <EmptyState title={t.studio.create.states.error} description={t.studio.create.failedDescription} />
          ) : activeTask.status === 'empty' ? (
            <EmptyState title={t.studio.create.emptyTitle} description={t.studio.create.emptyDescription} />
          ) : (
            <EmptyState title={t.studio.create.emptyTitle} description={t.studio.create.resultDescription} />
          )}
        </Panel>
        <Panel title={t.studio.create.recentTasks} description={t.studio.create.recentDescription}>
          {tasks.length === 0 ? (
            <EmptyState title={t.studio.create.recentTasks} description={t.studio.create.noTasks} />
          ) : (
            <div className="ob-studio-task-list">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  className={`ob-studio-task-item ${activeTaskId === task.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTaskId(task.id)}
                >
                  <strong>{task.id}</strong>
                  <span>{t.studio.create.states[task.status]}</span>
                  <p>{task.prompt}</p>
                </button>
              ))}
            </div>
          )}
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
