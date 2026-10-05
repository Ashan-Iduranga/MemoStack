import type { DeltaOp } from '@/models/types';
import type { Palette } from '@/theme/colors';
import { QUILL_CSS, QUILL_JS } from './quillAssets';

/// The single HTML page behind both the editor (`QuillEditor`) and the
/// reader (`QuillViewer`), so a note renders the same while it is written
/// and when it is read. Quill 2 is bundled (see quillAssets.ts), so the
/// page needs no network.
///
/// Messages the page posts to React Native. `change`/`format`/`focus` come
/// from edit mode only; `height` from read mode only.
export type QuillMessage =
  | { type: 'change'; delta: DeltaOp[]; text: string }
  | { type: 'format'; formats: Record<string, unknown> }
  | { type: 'focus'; focused: boolean }
  | { type: 'height'; height: number }
  | { type: 'link'; href: string };

/// Functions edit mode exposes on `window` for React Native to call via
/// `injectJavaScript` (see `QuillEditorHandle`):
///   msSetContents(ops)        replace the whole document
///   msFormat(key, value)      toggle a format on the selection
///   msInsertImage(url)        insert an image embed at the cursor
///   msLink(url, text)         link the selection, or insert linked text
///   msClearFormat()           strip formatting from the selection
///   msUndo() / msRedo()
///   msBlur()                  drop focus, which hides the keyboard

/// JSON that is safe to inline in a <script> — a `</script>` inside a
/// note's text must not end the script element.
export const inlineJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function quillDocument({
  mode,
  colors,
  delta,
  placeholder = '',
}: {
  mode: 'edit' | 'read';
  colors: Palette;
  delta: DeltaOp[];
  placeholder?: string;
}): string {
  const read = mode === 'read';
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>${QUILL_CSS}</style>
<style>
  html, body { margin: 0; padding: 0; background: transparent; ${read ? '' : 'height: 100%;'} }
  #editor { ${read ? '' : 'height: 100%;'} border: none !important; font-family: -apple-system, Roboto, sans-serif; font-size: ${read ? 17 : 16}px; color: ${colors.textPrimary}; }
  .ql-editor { padding: 0; line-height: ${read ? 1.65 : 1.5}; ${read ? 'overflow: visible;' : ''} }
  .ql-editor.ql-blank::before { left: 0; right: 0; color: ${colors.textSecondary}; font-style: normal; }
  .ql-editor h1 { font-size: 1.5em; margin: 0.6em 0 0.3em; }
  .ql-editor h2 { font-size: 1.25em; margin: 0.6em 0 0.3em; }
  .ql-editor p, .ql-editor li { margin-bottom: ${read ? '0.35em' : '0'}; }
  .ql-editor a { color: ${colors.accent}; }
  .ql-editor blockquote { border-left: 4px solid ${colors.accent} !important; color: ${colors.textSecondary}; padding-left: 12px !important; margin: 8px 0 !important; }
  .ql-editor .ql-code-block-container, .ql-editor pre.ql-code-block-container { background: ${colors.tagUniversityFill}; color: ${colors.textPrimary}; border-radius: 8px; padding: 8px 10px; }
  .ql-editor img { display: block; max-width: 100%; height: auto; border-radius: 12px; margin: 8px 0; }
  .ql-editor li[data-list=checked] > .ql-ui, .ql-editor li[data-list=unchecked] > .ql-ui { color: ${colors.accent}; }
</style></head><body>
<div id="editor"></div>
<script>${QUILL_JS}</script>
<script>
(function () {
  var READ = ${read};
  var post = function (msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };
  var Delta = Quill.import('delta');
  var quill = new Quill('#editor', {
    theme: 'snow',
    readOnly: READ,
    placeholder: ${inlineJson(placeholder)},
    // No Quill toolbar (React Native draws its own), and no paste/drop
    // image upload — Quill would inline the image as base64 data.
    modules: { toolbar: false, uploader: { handler: function () {} } },
  });

  // Only hosted (https) images may enter a note; pasted base64 or local
  // images are dropped. Images are added through the toolbar instead.
  quill.clipboard.addMatcher('IMG', function (node, delta) {
    return (node.getAttribute('src') || '').indexOf('https://') === 0 ? delta : new Delta();
  });

  // Never navigate inside the WebView; the reader opens links externally.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    e.preventDefault();
    if (READ) post({ type: 'link', href: a.getAttribute('href') });
  }, true);

  quill.setContents(${inlineJson(delta)}, 'silent');

  if (READ) {
    var last = 0;
    var reportHeight = function () {
      var h = Math.ceil(document.getElementById('editor').getBoundingClientRect().height);
      if (h !== last) { last = h; post({ type: 'height', height: h }); }
    };
    new ResizeObserver(reportHeight).observe(quill.root);
    reportHeight();
    return;
  }

  var emitChange = function () { post({ type: 'change', delta: quill.getContents().ops, text: quill.getText() }); };
  var emitFormat = function () {
    var r = quill.getSelection();
    post({ type: 'format', formats: r ? quill.getFormat(r) : {} });
  };
  quill.on('text-change', function (delta, old, source) { if (source === 'user') emitChange(); emitFormat(); });
  quill.on('selection-change', function (range) {
    if (range) emitFormat();
    post({ type: 'focus', focused: range != null });
  });

  window.msSetContents = function (ops) { quill.setContents(ops, 'silent'); emitFormat(); };
  window.msFormat = function (key, value) {
    var range = quill.getSelection(true);
    var current = quill.getFormat(range)[key];
    var on = typeof value === 'boolean'
      ? current != null
      : current === value || (key === 'list' && value === 'unchecked' && current === 'checked');
    quill.format(key, on ? false : value, 'user');
    emitFormat();
  };
  window.msInsertImage = function (url) {
    var index = quill.getSelection(true).index;
    // Code blocks can't hold embeds; put the image after the block's line.
    var line = quill.getLine(index);
    if (line[0] && quill.getFormat(index)['code-block']) index = index - line[1] + line[0].length();
    quill.insertEmbed(index, 'image', url, 'user');
    quill.insertText(index + 1, '\\n', 'user');
    quill.setSelection(index + 2, 'silent');
  };
  // The whole link around the cursor, as [index, length], or null.
  var linkAt = function (index) {
    var leaf = quill.getLeaf(index)[0];
    var parent = leaf && leaf.parent;
    if (!parent || parent.statics.blotName !== 'link') return null;
    return [quill.getIndex(parent), parent.length()];
  };
  window.msLink = function (url, text) {
    var range = quill.getSelection(true);
    var existing = range.length === 0 ? linkAt(range.index) : null;
    if (range.length > 0) {
      quill.formatText(range.index, range.length, 'link', url || false, 'user');
    } else if (existing) {
      quill.formatText(existing[0], existing[1], 'link', url || false, 'user');
    } else if (url) {
      var label = text || url;
      quill.insertText(range.index, label, { link: url }, 'user');
      quill.setSelection(range.index + label.length, 'silent');
    }
    emitFormat();
  };
  window.msClearFormat = function () {
    var range = quill.getSelection(true);
    if (range.length > 0) quill.removeFormat(range.index, range.length, 'user');
    else Object.keys(quill.getFormat(range)).forEach(function (k) { quill.format(k, false, 'user'); });
    emitFormat();
  };
  // The keyboard belongs to the WebView, so React Native's Keyboard.dismiss()
  // can't close it; blurring the editable element does.
  window.msBlur = function () {
    quill.blur();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  };
  window.msUndo = function () { quill.history.undo(); };
  window.msRedo = function () { quill.history.redo(); };
})();
</script></body></html>`;
}
