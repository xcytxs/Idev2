import { EditorView } from '@codemirror/view';
import type { Theme } from '~/types/theme';
import type { EditorSettings } from './CodeMirrorEditor';
import { StateEffect } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const themeEffect = StateEffect.define<Theme>();

export function getTheme(theme: Theme, settings?: EditorSettings) {
  const isDark = theme === 'dark';
  const colors = {
    // VS Code Dark+ theme colors
    background: isDark ? '#1e1e1e' : '#ffffff',
    foreground: isDark ? '#d4d4d4' : '#000000',
    cursor: isDark ? '#fff' : '#000',
    selection: isDark ? '#264f78' : '#add6ff',
    lineNumber: isDark ? '#858585' : '#237893',
    lineNumberActive: isDark ? '#c6c6c6' : '#237893',
    activeLine: isDark ? '#282828' : '#f8f8f8',
    activeLineGutter: 'transparent',
    selectionMatch: isDark ? '#3a3d41' : '#e8e8e8',
    matchingBracket: isDark ? '#3a3d41' : '#e8e8e8',
    
    // Syntax colors
    keyword: isDark ? '#569cd6' : '#0000ff',
    control: isDark ? '#c586c0' : '#af00db',
    operator: isDark ? '#d4d4d4' : '#000000',
    string: isDark ? '#ce9178' : '#a31515',
    stringEscape: isDark ? '#d7ba7d' : '#ff0000',
    regexp: isDark ? '#d16969' : '#811f3f',
    number: isDark ? '#b5cea8' : '#098658',
    boolean: isDark ? '#569cd6' : '#0000ff',
    null: isDark ? '#569cd6' : '#0000ff',
    comment: isDark ? '#6a9955' : '#008000',
    function: isDark ? '#dcdcaa' : '#795e26',
    className: isDark ? '#4ec9b0' : '#267f99',
    interface: isDark ? '#4ec9b0' : '#267f99',
    type: isDark ? '#4ec9b0' : '#267f99',
    enum: isDark ? '#4ec9b0' : '#267f99',
    typeParameter: isDark ? '#4ec9b0' : '#267f99',
    variable: isDark ? '#9cdcfe' : '#001080',
    property: isDark ? '#9cdcfe' : '#001080',
    constant: isDark ? '#4fc1ff' : '#0070c1',
    definition: isDark ? '#9cdcfe' : '#001080',
    punctuation: isDark ? '#d4d4d4' : '#000000',
    meta: isDark ? '#569cd6' : '#0000ff',
    tag: isDark ? '#569cd6' : '#800000',
    attributeName: isDark ? '#9cdcfe' : '#ff0000',
    attributeValue: isDark ? '#ce9178' : '#0000ff',
    heading: isDark ? '#569cd6' : '#800000',
    emphasis: isDark ? '#d4d4d4' : '#000000',
    strong: isDark ? '#d4d4d4' : '#000000',
    link: isDark ? '#569cd6' : '#0000ff',
  };

  const highlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: colors.keyword },
    { tag: tags.controlKeyword, color: colors.control },
    { tag: tags.operator, color: colors.operator },
    { tag: tags.string, color: colors.string },
    { tag: tags.regexp, color: colors.regexp },
    { tag: tags.escape, color: colors.stringEscape },
    { tag: tags.number, color: colors.number },
    { tag: tags.bool, color: colors.boolean },
    { tag: tags.null, color: colors.null },
    { tag: tags.comment, color: colors.comment, fontStyle: 'italic' },
    { tag: tags.function(tags.variableName), color: colors.function },
    { tag: tags.function(tags.definition(tags.variableName)), color: colors.function },
    { tag: tags.className, color: colors.className },
    { tag: tags.typeName, color: colors.type },
    { tag: tags.definition(tags.typeName), color: colors.type },
    { tag: tags.typeOperator, color: colors.type },
    { tag: tags.propertyName, color: colors.property },
    { tag: tags.definition(tags.propertyName), color: colors.property },
    { tag: tags.variableName, color: colors.variable },
    { tag: tags.definition(tags.variableName), color: colors.definition },
    { tag: tags.constant(tags.variableName), color: colors.constant },
    { tag: tags.punctuation, color: colors.punctuation },
    { tag: tags.meta, color: colors.meta },
    { tag: tags.tagName, color: colors.tag },
    { tag: tags.attributeName, color: colors.attributeName },
    { tag: tags.attributeValue, color: colors.attributeValue },
    { tag: tags.heading, color: colors.heading },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: 'bold' },
    { tag: tags.link, color: colors.link, textDecoration: 'underline' },
  ]);

  return [
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: settings?.fontSize ?? '14px',
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        backgroundColor: colors.background,
        color: colors.foreground,
      },
      '.cm-content': {
        padding: '0',
        caretColor: colors.cursor,
      },
      '.cm-line': {
        padding: '0 16px',
        lineHeight: '1.5',
      },
      '.cm-gutters': {
        backgroundColor: colors.background,
        color: colors.lineNumber,
        border: 'none',
        fontSize: settings?.gutterFontSize ?? '12px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: colors.activeLineGutter,
        color: colors.lineNumberActive,
      },
      '.cm-activeLine': {
        backgroundColor: colors.activeLine,
      },
      '.cm-selectionMatch': {
        backgroundColor: colors.selectionMatch,
      },
      '.cm-cursor': {
        borderLeftColor: colors.cursor,
      },
      '.cm-selected': {
        backgroundColor: colors.selection,
      },
      '.cm-matchingBracket': {
        backgroundColor: colors.matchingBracket,
        color: 'inherit !important',
        border: isDark ? '1px solid #888' : '1px solid #bbb',
      },
      // Change highlighting
      '.cm-line.cm-added': {
        backgroundColor: isDark ? '#1e4620' : '#e6ffe6',
      },
      '.cm-line.cm-changed': {
        backgroundColor: isDark ? '#462020' : '#ffe6e6',
      },
      // Scrollbar styling
      '&.cm-editor::-webkit-scrollbar': {
        width: '14px',
        height: '14px',
      },
      '&.cm-editor::-webkit-scrollbar-track': {
        backgroundColor: colors.background,
      },
      '&.cm-editor::-webkit-scrollbar-thumb': {
        backgroundColor: isDark ? '#424242' : '#c1c1c1',
        border: '3px solid transparent',
        borderRadius: '7px',
        backgroundClip: 'padding-box',
      },
      '&.cm-editor::-webkit-scrollbar-thumb:hover': {
        backgroundColor: isDark ? '#4f4f4f' : '#a8a8a8',
      },
      // Indent guides
      '.cm-indent': {
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          borderLeft: `1px solid ${isDark ? '#404040' : '#e8e8e8'}`,
        },
      },
    }),
    syntaxHighlighting(highlightStyle),
  ];
}
