import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

/// Icon choices for a module, keyed by the `iconKey` stored on its
/// `subjects` doc. Keys are stored data — rename the icon, never the key.
/// Shared by Home, Browse, and the admin module editor.
export const subjectIcons: Record<string, IconName> = {
  menuBook: 'menu-book',
  accountTree: 'account-tree',
  storage: 'storage',
  wifi: 'wifi',
  memory: 'memory',
  engineering: 'engineering',
  language: 'language',
  psychology: 'psychology',
  functions: 'functions',
  security: 'security',
  brush: 'brush',
};

export const subjectIconFor = (key: string): IconName => subjectIcons[key] ?? 'menu-book';
