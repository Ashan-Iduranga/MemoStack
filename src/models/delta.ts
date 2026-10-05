import type { DeltaOp } from './types';

/// Pure helpers over a note body (a Quill 2 Delta). Kept free of React and
/// Firebase so they are trivially unit-testable.

/// Image embeds look like `{ insert: { image: 'https://…' } }`.
function imageOf(op: DeltaOp): string | null {
  const insert = op.insert;
  if (insert == null || typeof insert !== 'object') return null;
  const image = (insert as Record<string, unknown>).image;
  return typeof image === 'string' ? image : null;
}

/// Every image URL in the body, in document order (duplicates removed).
export function imageUrlsIn(delta: DeltaOp[]): string[] {
  const urls: string[] = [];
  for (const op of delta) {
    const url = imageOf(op);
    if (url != null && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

/// Only images hosted over https are allowed in a published note — this
/// drops anything else (pasted base64 data, local file URIs) so a note can
/// never blow past Firestore's 1 MiB document limit.
export function withHostedImagesOnly(delta: DeltaOp[]): DeltaOp[] {
  return delta.filter((op) => {
    const url = imageOf(op);
    return url == null || url.startsWith('https://');
  });
}

/// Replaces image URLs via `map` (URLs missing from it are left as-is) —
/// used to point a saved note's images at on-device copies.
export function withImageUrls(delta: DeltaOp[], map: Record<string, string>): DeltaOp[] {
  return delta.map((op) => {
    const url = imageOf(op);
    if (url == null || map[url] == null) return op;
    return { ...op, insert: { ...(op.insert as Record<string, unknown>), image: map[url] } };
  });
}

/// The text content only (embeds skipped), as Quill's `getText()` returns it.
export function textOf(delta: DeltaOp[]): string {
  return delta.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');
}

/// A Delta holding `text` as a single unformatted paragraph — for notes
/// that only have plain text. Quill documents always end with a newline.
export function deltaFromText(text: string): DeltaOp[] {
  if (text.length === 0) return [];
  return [{ insert: text.endsWith('\n') ? text : `${text}\n` }];
}
