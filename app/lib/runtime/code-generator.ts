import { WebContainer } from '@webcontainer/api';
import { EditorView } from '@codemirror/view';

// Configuration for real-time code generation
const CHAR_DELAY = 25; // Slightly faster typing (25ms per character)
const LINE_DELAY = 300; // Moderate pause after newlines
const PUNCTUATION_DELAY = 100; // Moderate pause after punctuation

/**
 * Gets the current editor view
 */
function getEditorView(): EditorView | undefined {
  const editorPanel = document.querySelector('.cm-editor');
  if (!editorPanel) return undefined;
  
  // @ts-ignore - we know this exists because it's how CodeMirror stores the view
  return editorPanel.view;
}

/**
 * Generates code in real-time with typing animation effect
 */
export async function generateCode(
  webcontainer: WebContainer,
  filePath: string,
  content: string
): Promise<void> {
  let currentContent = '';
  
  // Write initial empty file
  await webcontainer.fs.writeFile(filePath, '');

  // Force scroll to top initially
  const editorView = getEditorView();
  if (editorView) {
    editorView.scrollDOM.scrollTop = 0;
    editorView.scrollDOM.style.scrollBehavior = 'auto';
  }

  // Write content character by character
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    currentContent += char;
    
    // Write current content
    await webcontainer.fs.writeFile(filePath, currentContent);

    // Add appropriate delays
    if (char === '\n') {
      await new Promise(resolve => setTimeout(resolve, LINE_DELAY));
    } else if ([',', '.', ';', '{', '}', '(', ')'].includes(char)) {
      await new Promise(resolve => setTimeout(resolve, PUNCTUATION_DELAY));
    } else {
      await new Promise(resolve => setTimeout(resolve, CHAR_DELAY));
    }
  }

  // Final write to ensure everything is saved
  await webcontainer.fs.writeFile(filePath, content);
}
