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
    brandSub: string;
    launcherTitle: string;
    launcherSubtitle: string;
    launcherPlaceholder: string;
    taskStatus: string;
    taskStatusHint: string;
    statusReady: string;
    quickActions: string;
    collaboration: string;
    jumpLabel: string;
    typing: string;
    launching: string;
    reconnecting: string;
    replyPlaceholder: string;
    continuePlaceholder: string;
    loadFailed: string;
    retry: string;
    coachDismiss: string;
    coachKicker: string;
    coachTitle: string;
    coachSubtitle: string;
  };
  studio: {
    title: string;
    subtitle: string;
    modes: {
      create: string;
      canvas: string;
      edit: string;
      motion: string;
      templates: string;
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
