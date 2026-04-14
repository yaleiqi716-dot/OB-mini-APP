export interface Messages {
  nav: {
    agent: string;
    workspace: string;
    studio: string;
    cloudBrowser: string;
    appCenter: string;
    projects: string;
    pricing: string;
    settings: string;
  };
  common: {
    workspaceStatus: string;
    focusAsset: string;
    openQueue: string;
    reuseLastPrompt: string;
    saveAsTemplate: string;
    singlePageMode: string;
    readyInStudio: string;
    dropRefImages: string;
    ready: string;
  };
  agent: {
    title: string;
    subtitle: string;
    launcherTitle: string;
    launcherSubtitle: string;
    taskStatus: string;
    quickActions: string;
    collaboration: string;
    jumpLabel: string;
    typing: string;
    launching: string;
  };
  studio: {
    title: string;
    subtitle: string;
    heroKicker: string;
    heroHint: string;
    modeDescriptions: {
      create: string;
      canvas: string;
      edit: string;
      motion: string;
      templates: string;
    };
    queueLabel: string;
    drawerDesc: string;
    drawerHint: string;
    modes: {
      create: string;
      canvas: string;
      edit: string;
      motion: string;
      templates: string;
    };
    create: {
      inputTitle: string;
      inputDesc: string;
      inputPlaceholder: string;
      generateBtn: string;
      refineBtn: string;
      resultTitle: string;
      resultDesc: string;
      progressLabel: string;
      resultPlaceholder: string;
      statusHint: string;
    };
    canvas: {
      stageTitle: string;
      stageDesc: string;
      canvasPlaceholder: string;
      toolsTitle: string;
      toolsDesc: string;
      addText: string;
      addLayer: string;
      alignGuide: string;
      snapToggle: string;
      layersHint: string;
    };
    edit: {
      previewTitle: string;
      previewDesc: string;
      previewPlaceholder: string;
      controlsTitle: string;
      controlsDesc: string;
      cropRatio: string;
      colorTune: string;
      copyReplace: string;
      compareHint: string;
    };
    motion: {
      sourceTitle: string;
      sourceDesc: string;
      previewPlaceholder: string;
      paramsTitle: string;
      paramsDesc: string;
      transition: string;
      keyframeSpeed: string;
      loopMode: string;
      timelineHint: string;
    };
    templatesMode: {
      libraryTitle: string;
      libraryDesc: string;
      officialTemplate: string;
      teamTemplate: string;
      applyTemplate: string;
    };
    rightRail: {
      styleDesc: string;
      advancedDesc: string;
      contextDesc: string;
      actionsDesc: string;
      brandStyle: string;
      visualStyle: string;
      tonePreset: string;
      sizeRatio: string;
      qualitySpeed: string;
      randomSeed: string;
      emptyRefs: string;
      publishDraft: string;
    };
    panels: {
      style: string;
      advanced: string;
      context: string;
      actions: string;
      drawer: string;
      recent: string;
      inspiration: string;
      templateLibrary: string;
    };
  };
  cloudBrowser: {
    title: string;
    region: string;
    states: {
      ready: string;
      booting: string;
      active: string;
      ended: string;
    };
    devices: {
      desktop: string;
      tablet: string;
      mobile: string;
    };
    panels: {
      controls: string;
      deviceView: string;
      statusUsage: string;
      taskMount: string;
    };
  };
}
