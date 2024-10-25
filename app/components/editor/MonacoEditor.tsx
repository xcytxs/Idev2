import { useEffect, useRef, useState } from 'react';
import type { Theme } from '~/types/theme';
import type { EditorDocument } from './codemirror/CodeMirrorEditor';
import type { editor } from 'monaco-editor';
import { setupMonaco } from '~/lib/monaco-setup';

interface MonacoEditorProps {
  theme: Theme;
  editable?: boolean;
  settings?: {
    fontSize?: string;
    tabSize?: number;
  };
  doc?: EditorDocument;
  autoFocusOnDocumentChange?: boolean;
  onScroll?: (scrollTop: number) => void;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export function MonacoEditor({
  theme,
  editable = true,
  settings,
  doc,
  autoFocusOnDocumentChange,
  onScroll,
  onChange,
  onSave,
}: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const [monaco, setMonaco] = useState<typeof import('monaco-editor')>();

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Load Monaco
    import('monaco-editor').then(async (module) => {
      await setupMonaco();
      setMonaco(module);
    });
  }, []);

  useEffect(() => {
    if (!monaco || !containerRef.current) return;

    // Initialize editor
    const editor = monaco.editor.create(containerRef.current, {
      value: doc?.value,
      language: getLanguage(doc?.filePath),
      theme: theme === 'dark' ? 'vs-dark' : 'vs',
      fontSize: parseInt(settings?.fontSize || '14'),
      tabSize: settings?.tabSize || 2,
      minimap: {
        enabled: false
      },
      scrollBeyondLastLine: false,
      renderWhitespace: 'boundary',
      readOnly: !editable,
      lineNumbers: 'on',
      wordWrap: 'on',
      folding: true,
      bracketPairColorization: {
        enabled: true
      },
      automaticLayout: true,
      scrollbar: {
        verticalScrollbarSize: 14,
        horizontalScrollbarSize: 14
      }
    });

    editorRef.current = editor;

    // Set up VSCode keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Set up scroll listener
    editor.onDidScrollChange((e) => {
      onScroll?.(e.scrollTop);
    });

    // Set up change listener
    editor.onDidChangeModelContent(() => {
      onChange?.(editor.getValue());
    });

    return () => {
      editor.dispose();
    };
  }, [monaco, containerRef.current]);

  useEffect(() => {
    if (!editorRef.current || !doc) return;

    // Update content if needed
    if (doc.value !== editorRef.current.getValue()) {
      editorRef.current.setValue(doc.value);
    }

    // Update language if needed
    const model = editorRef.current.getModel();
    if (model) {
      const currentLanguage = model.getLanguageId();
      const newLanguage = getLanguage(doc.filePath);
      if (currentLanguage !== newLanguage) {
        monaco?.editor.setModelLanguage(model, newLanguage);
      }
    }
  }, [doc?.value, doc?.filePath]);

  useEffect(() => {
    if (!editorRef.current || !monaco) return;
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }, [theme]);

  useEffect(() => {
    if (editorRef.current && autoFocusOnDocumentChange) {
      editorRef.current.focus();
    }
  }, [doc, autoFocusOnDocumentChange]);

  // Determine language from file extension
  const getLanguage = (filePath?: string) => {
    if (!filePath) return 'plaintext';
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
        return 'javascript';
      case 'jsx':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'css':
        return 'css';
      case 'scss':
        return 'scss';
      case 'html':
        return 'html';
      case 'py':
        return 'python';
      default:
        return 'plaintext';
    }
  };

  return <div ref={containerRef} className="h-full" />;
}
