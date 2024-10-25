import type * as monaco from 'monaco-editor';

// Configure Monaco editor with VSCode-like settings
export async function setupMonaco() {
  // Only run in browser
  if (typeof window === 'undefined') return;

  const monaco = await import('monaco-editor');

  // Configure editor defaults for dark theme (VSCode Dark+)
  monaco.editor.defineTheme('vs-dark', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      // Base tokens
      { token: '', foreground: 'd4d4d4' },
      { token: 'invalid', foreground: 'f44747' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold' },

      // Comments
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'comment.content', foreground: '6A9955' },

      // Variables
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'variable.predefined', foreground: '4FC1FF' },
      { token: 'variable.parameter', foreground: '9CDCFE' },

      // Keywords
      { token: 'keyword', foreground: '569CD6' },
      { token: 'keyword.control', foreground: 'C586C0' },
      { token: 'keyword.operator', foreground: 'D4D4D4' },

      // Types
      { token: 'type', foreground: '4EC9B0' },
      { token: 'type.identifier', foreground: '4EC9B0' },
      { token: 'type.parameter', foreground: '4EC9B0' },
      { token: 'type.enum', foreground: '4EC9B0' },
      { token: 'type.interface', foreground: '4EC9B0' },

      // Functions
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'function.declaration', foreground: 'DCDCAA' },

      // Classes
      { token: 'class', foreground: '4EC9B0' },
      { token: 'class.declaration', foreground: '4EC9B0' },

      // Strings
      { token: 'string', foreground: 'CE9178' },
      { token: 'string.escape', foreground: 'D7BA7D' },

      // Numbers
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'number.hex', foreground: 'B5CEA8' },

      // Properties
      { token: 'property', foreground: '9CDCFE' },
      { token: 'property.declaration', foreground: '9CDCFE' },

      // Tags and markup
      { token: 'tag', foreground: '569CD6' },
      { token: 'tag.attribute.name', foreground: '9CDCFE' },
      { token: 'tag.attribute.value', foreground: 'CE9178' },

      // Punctuation
      { token: 'delimiter', foreground: 'D4D4D4' },
      { token: 'delimiter.html', foreground: '808080' },
      { token: 'delimiter.xml', foreground: '808080' },

      // Special tokens
      { token: 'namespace', foreground: '4EC9B0' },
      { token: 'regex', foreground: 'D16969' },
      { token: 'annotation', foreground: 'DCDCAA' },
      { token: 'constant', foreground: '4FC1FF' }
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editor.lineHighlightBackground': '#2F2F2F',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41',
      'editor.selectionHighlightBackground': '#ADD6FF26',
      'editor.wordHighlightBackground': '#575757B8',
      'editor.wordHighlightStrongBackground': '#004972B8',
      'editor.findMatchBackground': '#515C6A',
      'editor.findMatchHighlightBackground': '#EA5C0055',
      
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#C6C6C6',
      
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
      
      'editorBracketMatch.background': '#0064001A',
      'editorBracketMatch.border': '#888888',
      
      'editorOverviewRuler.border': '#7F7F7F4D',
      'editorOverviewRuler.findMatchForeground': '#D18616',
      'editorOverviewRuler.rangeHighlightForeground': '#007ACC99',
      
      'scrollbarSlider.background': '#79797966',
      'scrollbarSlider.hoverBackground': '#646464B3',
      'scrollbarSlider.activeBackground': '#BFBFBF66'
    }
  });

  // Configure editor defaults for light theme (VSCode Light)
  monaco.editor.defineTheme('vs', {
    base: 'vs',
    inherit: false,
    rules: [
      // Base tokens
      { token: '', foreground: '000000' },
      { token: 'invalid', foreground: 'cd3131' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold' },

      // Comments
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'comment.content', foreground: '008000' },

      // Variables
      { token: 'variable', foreground: '001080' },
      { token: 'variable.predefined', foreground: '0070C1' },
      { token: 'variable.parameter', foreground: '001080' },

      // Keywords
      { token: 'keyword', foreground: '0000FF' },
      { token: 'keyword.control', foreground: 'AF00DB' },
      { token: 'keyword.operator', foreground: '000000' },

      // Types
      { token: 'type', foreground: '267F99' },
      { token: 'type.identifier', foreground: '267F99' },
      { token: 'type.parameter', foreground: '267F99' },
      { token: 'type.enum', foreground: '267F99' },
      { token: 'type.interface', foreground: '267F99' },

      // Functions
      { token: 'function', foreground: '795E26' },
      { token: 'function.declaration', foreground: '795E26' },

      // Classes
      { token: 'class', foreground: '267F99' },
      { token: 'class.declaration', foreground: '267F99' },

      // Strings
      { token: 'string', foreground: 'A31515' },
      { token: 'string.escape', foreground: 'FF0000' },

      // Numbers
      { token: 'number', foreground: '098658' },
      { token: 'number.hex', foreground: '098658' },

      // Properties
      { token: 'property', foreground: '001080' },
      { token: 'property.declaration', foreground: '001080' },

      // Tags and markup
      { token: 'tag', foreground: '800000' },
      { token: 'tag.attribute.name', foreground: 'FF0000' },
      { token: 'tag.attribute.value', foreground: '0000FF' },

      // Punctuation
      { token: 'delimiter', foreground: '000000' },
      { token: 'delimiter.html', foreground: '808080' },
      { token: 'delimiter.xml', foreground: '808080' },

      // Special tokens
      { token: 'namespace', foreground: '267F99' },
      { token: 'regex', foreground: '811F3F' },
      { token: 'annotation', foreground: '808080' },
      { token: 'constant', foreground: '0070C1' }
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editor.lineHighlightBackground': '#F8F8F8',
      'editor.selectionBackground': '#ADD6FF',
      'editor.inactiveSelectionBackground': '#E5EBF1',
      'editor.selectionHighlightBackground': '#ADD6FF80',
      'editor.wordHighlightBackground': '#57575740',
      'editor.wordHighlightStrongBackground': '#0E639C40',
      'editor.findMatchBackground': '#A8AC94',
      'editor.findMatchHighlightBackground': '#EA5C0055',
      
      'editorLineNumber.foreground': '#237893',
      'editorLineNumber.activeForeground': '#237893',
      
      'editorIndentGuide.background': '#D3D3D3',
      'editorIndentGuide.activeBackground': '#939393',
      
      'editorBracketMatch.background': '#0064001A',
      'editorBracketMatch.border': '#B9B9B9',
      
      'editorOverviewRuler.border': '#7F7F7F4D',
      'editorOverviewRuler.findMatchForeground': '#D18616',
      'editorOverviewRuler.rangeHighlightForeground': '#007ACC99',
      
      'scrollbarSlider.background': '#64646466',
      'scrollbarSlider.hoverBackground': '#646464B3',
      'scrollbarSlider.activeBackground': '#00000033'
    }
  });

  // Configure TypeScript/JavaScript settings
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: 'React',
    allowJs: true,
    typeRoots: ['node_modules/@types']
  });

  // Set formatting options
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false
  });

  // Configure JavaScript settings
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: true
  });

  // Set default theme
  monaco.editor.setTheme('vs-dark');
}
