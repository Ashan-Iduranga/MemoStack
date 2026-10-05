/**
 * @jest-environment node
 */
// Runs the real editor/reader page (quillDocument.ts + bundled Quill) in
// jsdom and drives the window.ms* bridge the toolbar uses. jsdom has no
// layout, so the size APIs Quill touches are stubbed.
import { JSDOM } from 'jsdom';

import { quillDocument, type QuillMessage } from '@/editor/quillDocument';
import type { DeltaOp } from '@/models/types';
import { lightPalette } from '@/theme/colors';

const NL = String.fromCharCode(10);

function load(mode: 'edit' | 'read', delta: DeltaOp[], placeholder = '') {
  const messages: QuillMessage[] = [];
  const html = quillDocument({ mode, colors: lightPalette, delta, placeholder });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(win) {
      const w = win as any;
      w.ReactNativeWebView = { postMessage: (m: string) => messages.push(JSON.parse(m)) };
      w.ResizeObserver = class {
        observe() {}
      };
      const rect = () => ({ top: 0, left: 0, right: 0, bottom: 100, width: 300, height: 100 });
      w.Range.prototype.getBoundingClientRect = rect;
      w.Range.prototype.getClientRects = () => [];
      w.Element.prototype.getBoundingClientRect = rect;
    },
  });
  const lastDelta = () => {
    const changes = messages.filter((m) => m.type === 'change');
    return (changes[changes.length - 1] as Extract<QuillMessage, { type: 'change' }>).delta;
  };
  return { win: dom.window as any, messages, lastDelta };
}

const hasImage = (delta: DeltaOp[], url: string) =>
  delta.some((op) => (op.insert as { image?: string } | undefined)?.image === url);

describe('edit page', () => {
  test('inserts images and links at the cursor', () => {
    const page = load('edit', [{ insert: `hello world${NL}` }]);
    page.win.msInsertImage('https://example.com/a.jpg');
    expect(hasImage(page.lastDelta(), 'https://example.com/a.jpg')).toBe(true);

    page.win.msLink('https://example.com', 'Example');
    expect(page.lastDelta()).toContainEqual({ insert: 'Example', attributes: { link: 'https://example.com' } });
  });

  test('toggles block formats', () => {
    const page = load('edit', [{ insert: `item${NL}` }]);
    page.win.msFormat('list', 'unchecked');
    expect(page.lastDelta()).toContainEqual({ insert: NL, attributes: { list: 'unchecked' } });
    page.win.msFormat('list', 'unchecked');
    expect(page.lastDelta()).toEqual([{ insert: `item${NL}` }]);
  });

  test('an image inserted inside a code block lands after it', () => {
    const page = load('edit', [{ insert: 'code' }, { insert: NL, attributes: { 'code-block': 'plain' } }]);
    page.win.msInsertImage('https://example.com/a.jpg');
    expect(hasImage(page.lastDelta(), 'https://example.com/a.jpg')).toBe(true);
  });

  test('msBlur drops focus and reports it', () => {
    const page = load('edit', [{ insert: `hello${NL}` }]);
    page.win.msFormat('bold', true); // focuses the editor
    expect(page.messages).toContainEqual({ type: 'focus', focused: true });
    page.win.msBlur();
    expect(page.win.document.activeElement).not.toBe(page.win.document.querySelector('.ql-editor'));
  });

  test('loads older code-block: true notes as Quill 2 code blocks', () => {
    const page = load('edit', [{ insert: 'x = 1' }, { insert: NL, attributes: { 'code-block': true } }]);
    expect(page.win.document.querySelector('.ql-code-block')).not.toBeNull();
  });

  test('note content cannot break out of the script tag', () => {
    const page = load('edit', [{ insert: `</script><b>hi</b>${NL}` }], 'a </script> b');
    expect(page.win.document.querySelector('.ql-editor').getAttribute('data-placeholder')).toBe('a </script> b');
    expect(page.win.document.querySelector('.ql-editor').textContent).toBe('</script><b>hi</b>');
  });
});

describe('read page', () => {
  test('is read-only, reports its height, and hands links to the app', () => {
    const page = load('read', [
      { insert: 'Go ' },
      { insert: 'here', attributes: { link: 'https://ex.com' } },
      { insert: NL },
      { insert: { image: 'https://ex.com/i.jpg' } },
      { insert: NL },
    ]);
    const doc = page.win.document;
    expect(doc.querySelector('.ql-editor').getAttribute('contenteditable')).toBe('false');
    expect(doc.querySelector('img').getAttribute('src')).toBe('https://ex.com/i.jpg');
    expect(page.messages).toContainEqual({ type: 'height', height: 100 });

    doc.querySelector('a').click();
    expect(page.messages).toContainEqual({ type: 'link', href: 'https://ex.com' });
    expect(page.win.msInsertImage).toBeUndefined();
  });
});
