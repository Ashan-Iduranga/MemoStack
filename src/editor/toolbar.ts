import type { IconName } from '@/utils/subjectIcons';

/// What a toolbar button does:
///   format  toggle a Quill format (`key`/`value` as Quill names them)
///   command run an editor command (undo, redo, clear formatting)
///   image / link  ask the screen for input first (picker, URL dialog)
export type ToolbarAction =
  | { kind: 'format'; key: string; value: string | number | boolean }
  | { kind: 'command'; command: 'msUndo' | 'msRedo' | 'msClearFormat' }
  | { kind: 'image' }
  | { kind: 'link' };

export interface ToolbarButton {
  id: string;
  label: string; // accessibility label
  icon?: IconName;
  text?: string; // shown instead of an icon, e.g. "H1"
  action: ToolbarAction;
  /// Highlighted when the cursor is inside this format.
  isActive?: (formats: Record<string, unknown>) => boolean;
}

const toggle = (key: string, value: string | number | boolean = true) => ({
  action: { kind: 'format', key, value } as const,
  isActive: (f: Record<string, unknown>) => (value === true ? f[key] != null : f[key] === value),
});

/// The editor toolbar, in groups (a gap is drawn between groups). To add a
/// format, add a button here — anything Quill 2's core formats support
/// (https://quilljs.com/docs/formats) works without touching the page.
export const TOOLBAR_GROUPS: ToolbarButton[][] = [
  [
    { id: 'undo', label: 'Undo', icon: 'undo', action: { kind: 'command', command: 'msUndo' } },
    { id: 'redo', label: 'Redo', icon: 'redo', action: { kind: 'command', command: 'msRedo' } },
  ],
  [
    { id: 'h1', label: 'Heading', text: 'H1', ...toggle('header', 1) },
    { id: 'h2', label: 'Subheading', text: 'H2', ...toggle('header', 2) },
  ],
  [
    { id: 'bold', label: 'Bold', icon: 'format-bold', ...toggle('bold') },
    { id: 'italic', label: 'Italic', icon: 'format-italic', ...toggle('italic') },
    { id: 'underline', label: 'Underline', icon: 'format-underlined', ...toggle('underline') },
    { id: 'strike', label: 'Strikethrough', icon: 'strikethrough-s', ...toggle('strike') },
  ],
  [
    { id: 'bullet', label: 'Bulleted list', icon: 'format-list-bulleted', ...toggle('list', 'bullet') },
    { id: 'ordered', label: 'Numbered list', icon: 'format-list-numbered', ...toggle('list', 'ordered') },
    {
      id: 'checklist',
      label: 'Checklist',
      icon: 'checklist',
      action: { kind: 'format', key: 'list', value: 'unchecked' },
      isActive: (f) => f.list === 'checked' || f.list === 'unchecked',
    },
    { id: 'quote', label: 'Quote', icon: 'format-quote', ...toggle('blockquote') },
    { id: 'code', label: 'Code block', icon: 'code', ...toggle('code-block') },
  ],
  [
    { id: 'link', label: 'Link', icon: 'link', action: { kind: 'link' }, isActive: (f) => f.link != null },
    { id: 'image', label: 'Insert image', icon: 'image', action: { kind: 'image' } },
    { id: 'clear', label: 'Clear formatting', icon: 'format-clear', action: { kind: 'command', command: 'msClearFormat' } },
  ],
];
