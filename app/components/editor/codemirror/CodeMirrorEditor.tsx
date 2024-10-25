import { acceptCompletion, autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput, indentUnit } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { Compartment, EditorSelection, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  showTooltip,
  tooltips,
  ViewPlugin,
  ViewUpdate,
  type Tooltip,
  type DecorationSet,
} from '@codemirror/view';
import { memo, useEffect, useRef, useState } from 'react';
import type { Theme } from '~/types/theme';
import { classNames } from '~/utils/classNames';
import { debounce } from '~/utils/debounce';
import { createScopedLogger } from '~/utils/logger';
import { BinaryContent } from './BinaryContent';
import { getTheme, themeEffect } from './cm-theme';
import { indentKeyBinding } from './indent';
import { getLanguage } from './languages';

const logger = createScopedLogger('CodeMirrorEditor');

export interface EditorDocument {
  value: string;
  isBinary: boolean;
  filePath: string;
  scroll?: ScrollPosition;
}

export interface EditorSettings {
  fontSize?: string;
  gutterFontSize?: string;
  tabSize?: number;
}

export interface ScrollPosition {
  top: number;
  left: number;
}

export interface EditorUpdate {
  selection: EditorSelection;
  content: string;
}

export type OnChangeCallback = (update: EditorUpdate) => void;
export type OnScrollCallback = (position: ScrollPosition) => void;
export type OnSaveCallback = () => void;

interface Props {
  theme: Theme;
  id?: unknown;
  doc?: EditorDocument;
  editable?: boolean;
  debounceChange?: number;
  debounceScroll?: number;
  autoFocusOnDocumentChange?: boolean;
  onChange?: OnChangeCallback;
  onScroll?: OnScrollCallback;
  onSave?: OnSaveCallback;
  className?: string;
  settings?: EditorSettings;
}

type EditorStates = Map<string, EditorState>;

const editableStateEffect = StateEffect.define<boolean>();

const editableStateField = StateField.define<boolean>({
  create() {
    return true;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(editableStateEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

// Create decorations for change highlighting
const addedLineDecoration = Decoration.line({ class: 'cm-line cm-added' });
const changedLineDecoration = Decoration.line({ class: 'cm-line cm-changed' });

const changeHighlighter = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = Decoration.none;
  }

  update(update: ViewUpdate) {
    if (!update.docChanged) return;
    
    let decorations: Array<{ from: number; to: number; decoration: Decoration }> = [];
    
    update.changes.iterChanges((fromA: number, toA: number, fromB: number, toB: number) => {
      const decoration = fromA === toA ? addedLineDecoration : changedLineDecoration;
      const lineStart = update.state.doc.lineAt(fromB).from;
      const lineEnd = update.state.doc.lineAt(toB).to;
      decorations.push({ from: lineStart, to: lineEnd, decoration });
    });
    
    this.decorations = Decoration.set(decorations.map(({ from, to, decoration }) => 
      decoration.range(from, to)
    ));
  }
}, {
  decorations: v => v.decorations,
});

export const CodeMirrorEditor = memo(
  ({
    id,
    doc,
    debounceScroll = 100,
    debounceChange = 150,
    autoFocusOnDocumentChange = false,
    editable = true,
    onScroll,
    onChange,
    onSave,
    theme,
    settings,
    className = '',
  }: Props) => {
    const [languageCompartment] = useState(new Compartment());
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView>();
    const editorStatesRef = useRef<EditorStates>(new Map());
    const lastScrollTime = useRef(0);
    const isScrolling = useRef(false);

    // Initialize editor
    useEffect(() => {
      const initializeEditor = async () => {
        let languageSupport: Extension | undefined;
        if (doc?.filePath) {
          languageSupport = await getLanguage(doc.filePath);
        }

        const view = new EditorView({
          parent: containerRef.current!,
          dispatch: (tr) => {
            view.update([tr]);
            if (tr.docChanged) {
              onChange?.({
                selection: view.state.selection,
                content: view.state.doc.toString(),
              });

              // Smart scrolling
              const now = Date.now();
              if (!isScrolling.current && now - lastScrollTime.current > 100) {
                const visibleLines = Math.floor(view.dom.clientHeight / 20);
                const totalLines = view.state.doc.lines;
                
                if (totalLines > visibleLines * 2) {
                  isScrolling.current = true;
                  requestAnimationFrame(() => {
                    const targetLine = Math.max(1, totalLines - Math.floor(visibleLines * 0.75));
                    const pos = view.state.doc.line(targetLine).from;
                    view.scrollDOM.scrollTop = view.lineBlockAt(pos).top;
                    lastScrollTime.current = now;
                    isScrolling.current = false;
                  });
                }
              }
            }
          },
        });

        viewRef.current = view;

        // Set initial state with language support
        if (doc) {
          const state = EditorState.create({
            doc: doc.value,
            extensions: [
              getTheme(theme, settings),
              history(),
              keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
                ...searchKeymap,
                { key: 'Tab', run: acceptCompletion },
                {
                  key: 'Mod-s',
                  preventDefault: true,
                  run: () => {
                    onSave?.();
                    return true;
                  },
                },
                indentKeyBinding,
              ]),
              indentUnit.of('\t'),
              autocompletion({ closeOnBlur: false }),
              closeBrackets(),
              lineNumbers(),
              dropCursor(),
              drawSelection(),
              bracketMatching(),
              EditorState.tabSize.of(settings?.tabSize ?? 2),
              indentOnInput(),
              editableStateField,
              EditorState.readOnly.from(editableStateField, (editable) => !editable),
              highlightActiveLineGutter(),
              highlightActiveLine(),
              changeHighlighter,
              EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                  editorStatesRef.current.set(doc.filePath, update.state);
                }
              }),
              EditorView.domEventHandlers({
                scroll: debounce((event, view) => {
                  if (event.target !== view.scrollDOM) return;
                  onScroll?.({
                    left: view.scrollDOM.scrollLeft,
                    top: view.scrollDOM.scrollTop,
                  });
                }, debounceScroll),
              }),
              languageCompartment.of(languageSupport ? [languageSupport] : []),
            ],
          });

          view.setState(state);
          editorStatesRef.current.set(doc.filePath, state);
        }
      };

      initializeEditor();

      return () => {
        viewRef.current?.destroy();
        viewRef.current = undefined;
      };
    }, []);

    // Handle theme changes
    useEffect(() => {
      if (!viewRef.current) return;
      viewRef.current.dispatch({
        effects: themeEffect.of(theme)
      });
    }, [theme]);

    // Handle document changes
    useEffect(() => {
      if (!viewRef.current || !doc) return;

      const view = viewRef.current;

      // Create new state if needed
      let state = editorStatesRef.current.get(doc.filePath);
      if (!state) {
        getLanguage(doc.filePath).then(languageSupport => {
          state = EditorState.create({
            doc: doc.value,
            extensions: [
              getTheme(theme, settings),
              history(),
              keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
                ...searchKeymap,
                { key: 'Tab', run: acceptCompletion },
                {
                  key: 'Mod-s',
                  preventDefault: true,
                  run: () => {
                    onSave?.();
                    return true;
                  },
                },
                indentKeyBinding,
              ]),
              indentUnit.of('\t'),
              autocompletion({ closeOnBlur: false }),
              closeBrackets(),
              lineNumbers(),
              dropCursor(),
              drawSelection(),
              bracketMatching(),
              EditorState.tabSize.of(settings?.tabSize ?? 2),
              indentOnInput(),
              editableStateField,
              EditorState.readOnly.from(editableStateField, (editable) => !editable),
              highlightActiveLineGutter(),
              highlightActiveLine(),
              changeHighlighter,
              EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                  editorStatesRef.current.set(doc.filePath, update.state);
                }
              }),
              EditorView.domEventHandlers({
                scroll: debounce((event, view) => {
                  if (event.target !== view.scrollDOM) return;
                  onScroll?.({
                    left: view.scrollDOM.scrollLeft,
                    top: view.scrollDOM.scrollTop,
                  });
                }, debounceScroll),
              }),
              languageCompartment.of(languageSupport ? [languageSupport] : []),
            ],
          });

          editorStatesRef.current.set(doc.filePath, state);
          view.setState(state!);
        });
      } else {
        view.setState(state);
      }

      // Update content if needed
      if (doc.value !== view.state.doc.toString()) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: doc.value,
          },
        });
      }

      // Set editable state
      view.dispatch({
        effects: editableStateEffect.of(editable && !doc.isBinary),
      });

    }, [doc?.value, doc?.filePath, editable]);

    return (
      <div className={classNames('relative h-full', className)}>
        {doc?.isBinary && <BinaryContent />}
        <div className="h-full overflow-hidden" ref={containerRef} />
      </div>
    );
  },
);

export default CodeMirrorEditor;
