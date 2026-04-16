// Part of OrangeBench product internal design system

export interface Workspace {
  id: string;
  name: string;
  active: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  group: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
}
