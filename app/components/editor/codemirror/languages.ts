import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import type { Extension } from '@codemirror/state';

const languageMap: Record<string, () => Promise<Extension>> = {
  // JavaScript/TypeScript
  js: () => Promise.resolve(javascript({ typescript: false })),
  jsx: () => Promise.resolve(javascript({ jsx: true })),
  ts: () => Promise.resolve(javascript({ typescript: true })),
  tsx: () => Promise.resolve(javascript({ typescript: true, jsx: true })),
  mjs: () => Promise.resolve(javascript()),
  cjs: () => Promise.resolve(javascript()),

  // JSON
  json: () => Promise.resolve(json()),

  // Markdown
  md: () => Promise.resolve(markdown()),
  markdown: () => Promise.resolve(markdown()),

  // HTML
  html: () => Promise.resolve(html()),
  htm: () => Promise.resolve(html()),

  // CSS
  css: () => Promise.resolve(css()),
  scss: () => Promise.resolve(css()),
  sass: () => Promise.resolve(css()),
  less: () => Promise.resolve(css()),

  // Python
  py: () => Promise.resolve(python()),
  python: () => Promise.resolve(python()),
};

export async function getLanguage(filePath: string): Promise<Extension | undefined> {
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (!extension) return undefined;

  const loader = languageMap[extension];
  if (!loader) return undefined;

  try {
    const language = await loader();
    return language;
  } catch (error) {
    console.error('Failed to load language support:', error);
    return undefined;
  }
}
