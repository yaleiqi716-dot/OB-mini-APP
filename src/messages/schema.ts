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
    launcherTitleLead: string;
    launcherTitleAccent: string;
    launcherSubtitle: string;
    taskStatus: string;
    quickActions: string;
    collaboration: string;
    jumpLabel: string;
    typing: string;
    launching: string;
    quickNavDesc: {
      tasks: string;
      workspace: string;
      account: string;
    };
    statusWords: {
      understand: string;
      breakdown: string;
      plan: string;
      generate: string;
      deliver: string;
    };
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
