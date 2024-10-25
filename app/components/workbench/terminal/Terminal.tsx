import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { getTerminalTheme } from './theme';
import { workbenchStore } from '~/lib/stores/workbench';

const logger = createScopedLogger('Terminal');

const PROMPT = '\r\n\x1b[32m$ >>\x1b[0m '; // Green $ >> prompt
const INPUT_PREFIX = '\x1b[32m>>\x1b[0m '; // Green >> for input line

export interface TerminalRef {
  reloadStyles: () => void;
}

export interface TerminalProps {
  className?: string;
  theme: Theme;
  readonly?: boolean;
  onTerminalReady?: (terminal: XTerm) => void;
  onTerminalResize?: (cols: number, rows: number) => void;
}

export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(({ className, theme, readonly, onTerminalReady, onTerminalResize }, ref) => {
    const terminalElementRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<XTerm>();
    const fitAddonRef = useRef<FitAddon>();
    const inputBufferRef = useRef<string>('');
    const cursorPosRef = useRef<number>(0);

    const writeInputLine = (terminal: XTerm, content: string = '', cursorPos: number = 0) => {
      terminal.write('\x1b[2K\r' + INPUT_PREFIX + ' ' + content);
      if (cursorPos < content.length) {
        terminal.write('\x1b[' + (content.length - cursorPos) + 'D');
      }
    };

    useEffect(() => {
      const element = terminalElementRef.current!;

      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      const webLinksAddon = new WebLinksAddon();

      const terminal = new XTerm({
        cursorBlink: true,
        cursorStyle: 'bar',
        cursorWidth: 2,
        convertEol: true,
        disableStdin: readonly,
        theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {
          cursor: '#00ff00',
          cursorAccent: '#00ff00'
        }),
        fontSize: 12,
        fontFamily: 'Menlo, courier-new, courier, monospace',
        scrollback: 5000,
        rows: 24,
        cols: 80,
        allowProposedApi: true
      });

      terminalRef.current = terminal;

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(element);

      // Handle user input
      terminal.onData((data) => {
        if (readonly) return;

        // Handle special keys
        if (data === '\r') { // Enter key
          const command = inputBufferRef.current.trim();
          if (command) {
            terminal.write('\r\n');
            workbenchStore.handleTerminalInput(command);
          }
          inputBufferRef.current = '';
          cursorPosRef.current = 0;
          writeInputLine(terminal);
          return;
        }

        if (data === '\u007f') { // Backspace
          if (inputBufferRef.current.length > 0 && cursorPosRef.current > 0) {
            const beforeCursor = inputBufferRef.current.slice(0, cursorPosRef.current - 1);
            const afterCursor = inputBufferRef.current.slice(cursorPosRef.current);
            inputBufferRef.current = beforeCursor + afterCursor;
            cursorPosRef.current--;
            writeInputLine(terminal, inputBufferRef.current, cursorPosRef.current);
          }
          return;
        }

        if (data === '\u0003') { // Ctrl+C
          terminal.write('^C' + PROMPT);
          inputBufferRef.current = '';
          cursorPosRef.current = 0;
          writeInputLine(terminal);
          return;
        }

        // Regular input
        const beforeCursor = inputBufferRef.current.slice(0, cursorPosRef.current);
        const afterCursor = inputBufferRef.current.slice(cursorPosRef.current);
        inputBufferRef.current = beforeCursor + data + afterCursor;
        cursorPosRef.current += data.length;
        writeInputLine(terminal, inputBufferRef.current, cursorPosRef.current);
      });

      // Initial fit
      setTimeout(() => {
        fitAddon.fit();
      }, 0);

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        onTerminalResize?.(terminal.cols, terminal.rows);
      });

      resizeObserver.observe(element);

      logger.info('Attach terminal');

      // Clear terminal and show initial prompt
      terminal.clear();
      terminal.write('\x1b[2J\x1b[H');
      terminal.write(PROMPT);
      writeInputLine(terminal);

      // Handle terminal output
      const originalWrite = terminal.write.bind(terminal);
      terminal.write = (data: string | Uint8Array) => {
        const result = originalWrite(data);
        // After any output, ensure the input line is visible
        if (typeof data === 'string' && !data.includes(INPUT_PREFIX)) {
          writeInputLine(terminal, inputBufferRef.current, cursorPosRef.current);
        }
        return result;
      };

      onTerminalReady?.(terminal);

      return () => {
        resizeObserver.disconnect();
        terminal.dispose();
      };
    }, []);

    useEffect(() => {
      const terminal = terminalRef.current!;

      // we render a transparent cursor in case the terminal is readonly
      terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {
        cursor: '#00ff00',
        cursorAccent: '#00ff00'
      });
      terminal.options.disableStdin = readonly;

      // Refit terminal when theme changes
      if (fitAddonRef.current) {
        setTimeout(() => {
          fitAddonRef.current?.fit();
        }, 0);
      }
    }, [theme, readonly]);

    useImperativeHandle(ref, () => {
      return {
        reloadStyles: () => {
          const terminal = terminalRef.current!;
          terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {
            cursor: '#00ff00',
            cursorAccent: '#00ff00'
          });
          // Refit terminal when styles change
          if (fitAddonRef.current) {
            setTimeout(() => {
              fitAddonRef.current?.fit();
            }, 0);
          }
        },
      };
    }, []);

    return <div className={className} ref={terminalElementRef} />;
  }),
);
