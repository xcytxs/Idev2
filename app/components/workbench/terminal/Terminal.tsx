import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { getTerminalTheme } from './theme';

const logger = createScopedLogger('Terminal');

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

    useEffect(() => {
      const element = terminalElementRef.current!;

      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      const webLinksAddon = new WebLinksAddon();

      const terminal = new XTerm({
        cursorBlink: true,
        convertEol: true,
        disableStdin: readonly,
        theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {}),
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

      // Clear terminal and show prompt
      terminal.clear();
      terminal.write('\x1b[2J\x1b[H');
      terminal.write('\r\n$ ');

      onTerminalReady?.(terminal);

      return () => {
        resizeObserver.disconnect();
        terminal.dispose();
      };
    }, []);

    useEffect(() => {
      const terminal = terminalRef.current!;

      // we render a transparent cursor in case the terminal is readonly
      terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
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
          terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
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
