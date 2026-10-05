// Only the pure helpers are under test; keep Firebase out of Jest.
jest.mock('firebase/firestore', () => ({ Timestamp: class {}, serverTimestamp: () => null }));

import { deltaFromText, imageUrlsIn, textOf, withHostedImagesOnly, withImageUrls } from '@/models/delta';
import { noteBody, noteDisplayText, type Note } from '@/models/types';
import { formatBytes, formatCount, initialsFor, timeAgo } from '@/utils/format';
import { normalizeUrl } from '@/utils/validators';

describe('Delta helpers', () => {
  const A = 'https://firebasestorage.googleapis.com/a.jpg';
  const B = 'https://firebasestorage.googleapis.com/b.jpg';
  const delta = [
    { insert: 'Intro\n', attributes: { header: 1 } },
    { insert: { image: A } },
    { insert: { image: 'data:image/png;base64,AAAA' } },
    { insert: 'Body ' },
    { insert: { image: B } },
    { insert: { image: A } },
    { insert: 'end\n' },
  ];

  test('imageUrlsIn lists unique images in order', () => {
    expect(imageUrlsIn(delta)).toEqual([A, 'data:image/png;base64,AAAA', B]);
  });

  test('withHostedImagesOnly drops non-https images and keeps text', () => {
    const cleaned = withHostedImagesOnly(delta);
    expect(imageUrlsIn(cleaned)).toEqual([A, B]);
    expect(textOf(cleaned)).toBe('Intro\nBody end\n');
  });

  test('withImageUrls swaps mapped images only', () => {
    const swapped = withImageUrls(delta, { [A]: 'data:local' });
    expect(imageUrlsIn(swapped)).toEqual(['data:local', 'data:image/png;base64,AAAA', B]);
    expect(swapped[0]).toBe(delta[0]);
  });

  test('deltaFromText ends with a newline', () => {
    expect(deltaFromText('Hi')).toEqual([{ insert: 'Hi\n' }]);
    expect(deltaFromText('')).toEqual([]);
  });

  test('noteBody falls back to plain text', () => {
    const note = { contentDelta: [], plainText: 'Plain' } as unknown as Note;
    expect(noteBody(note)).toEqual([{ insert: 'Plain\n' }]);
  });

  test('legacy code-block: true ops pass through untouched', () => {
    const legacy = [{ insert: 'x' }, { insert: '\n', attributes: { 'code-block': true } }];
    expect(withHostedImagesOnly(legacy)).toEqual(legacy);
  });
});

describe('normalizeUrl', () => {
  test('adds https to bare domains, keeps schemes', () => {
    expect(normalizeUrl(' example.com ')).toBe('https://example.com');
    expect(normalizeUrl('http://x.org')).toBe('http://x.org');
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(normalizeUrl('  ')).toBe('');
  });
});

describe('noteDisplayText', () => {
  const base = { plainText: '', contentDelta: [] } as unknown as Note;

  test('prefers plainText', () => {
    expect(noteDisplayText({ ...base, plainText: 'Hello' })).toBe('Hello');
  });

  test('falls back to the Delta inserts for hand-added notes', () => {
    expect(noteDisplayText({ ...base, contentDelta: [{ insert: 'A' }, { insert: { image: 'x' } }, { insert: 'B\n' }] })).toBe(
      'AB\n',
    );
  });
});

describe('format helpers', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const ago = (ms: number) => timeAgo(new Date(now.getTime() - ms), now);

  test('timeAgo wording', () => {
    expect(ago(10_000)).toBe('a moment ago');
    expect(ago(60_000)).toBe('a minute ago');
    expect(ago(5 * 60_000)).toBe('5 minutes ago');
    expect(ago(60 * 60_000)).toBe('about an hour ago');
    expect(ago(3 * 3600_000)).toBe('3 hours ago');
    expect(ago(30 * 3600_000)).toBe('a day ago');
    expect(ago(4 * 86400_000)).toBe('4 days ago');
    expect(ago(400 * 86400_000)).toBe('about a year ago');
  });

  test('counts, sizes, initials', () => {
    expect(formatCount(950)).toBe('950');
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(12000)).toBe('12k');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
    expect(initialsFor('Ada Lovelace')).toBe('AL');
    expect(initialsFor('')).toBe('?');
  });
});
