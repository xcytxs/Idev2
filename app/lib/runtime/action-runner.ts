import { WebContainer } from '@webcontainer/api';
import { map, type MapStore } from 'nanostores';
import * as nodePath from 'node:path';
import type { BoltAction } from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { Terminal as XTerm } from '@xterm/xterm';

const logger = createScopedLogger('ActionRunner');

const PROMPT = '\r\n\x1b[32m$ >>\x1b[0m '; // Green $ >> prompt
const INPUT_PREFIX = '\x1b[32m>>\x1b[0m '; // Green >> for input line

const writeInputLine = (terminal: XTerm) => {
  terminal.write('\x1b[2K\r' + INPUT_PREFIX + ' ');
};

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();
  #currentProcess: any = null;
  #currentActionId: string | null = null;

  actions: ActionsMap = map({});

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      // action already added
      return;
    }

    const abortController = new AbortController();

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      this.#updateAction(actionId, { status: 'running' });
    });
  }

  async runAction(data: ActionCallbackData) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return;
    }

    this.#updateAction(actionId, { ...action, ...data.action, executed: true });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId);
      })
      .catch((error: unknown) => {
        console.error('Action failed:', error);
        const terminal = workbenchStore.terminal;
        if (terminal) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          terminal.write(`\r\nError: ${errorMessage}${PROMPT}`);
          writeInputLine(terminal);
        }
      });
  }

  async #executeAction(actionId: string) {
    const action = this.actions.get()[actionId];
    this.#currentActionId = actionId;

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          await this.#runShellAction(action);
          break;
        }
        case 'file': {
          await this.#runFileAction(action);
          break;
        }
      }

      // Don't update status for npm run dev - it will be updated when server is ready
      if (!(action.type === 'shell' && action.content.includes('npm run dev'))) {
        this.#updateAction(actionId, { status: action.abortSignal.aborted ? 'aborted' : 'complete' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.#updateAction(actionId, { status: 'failed', error: errorMessage });

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runShellAction(action: ActionState) {
    if (action.type !== 'shell') {
      unreachable('Expected shell action');
    }

    const webcontainer = await this.#webcontainer;

    // Show terminal before running command
    workbenchStore.toggleTerminal(true);

    // Wait for terminal to be ready
    const terminal = await new Promise<XTerm>((resolve) => {
      const checkTerminal = () => {
        const term = workbenchStore.terminal;
        if (term) {
          resolve(term);
        } else {
          setTimeout(checkTerminal, 100);
        }
      };
      checkTerminal();
    });

    // Display the command being executed with green prompt
    terminal.write(`\r\n\x1b[32m$ >>\x1b[0m ${action.content}`);

    const process = await webcontainer.spawn('jsh', ['-c', action.content], {
      env: { npm_config_yes: true },
    });

    this.#currentProcess = process;

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });

    // Set up a flag to track if we've shown the ready message
    let readyMessageShown = false;

    process.output.pipeTo(
      new WritableStream({
        write: (data) => {
          console.log(data);
          terminal.write(data);

          // Check for dev server ready message
          if (!readyMessageShown && 
              (data.includes('Local:') || data.includes('localhost:')) && 
              action.content.includes('npm run dev')) {
            terminal.write('\r\n✓ Development server is ready\r\n');
            readyMessageShown = true;
            // Update the action status to complete when dev server is ready
            if (this.#currentActionId) {
              this.#updateAction(this.#currentActionId, { status: 'complete' });
            }
            writeInputLine(terminal);
          }
        },
      }),
    );

    const exitCode = await process.exit;
    this.#currentProcess = null;

    if (exitCode !== 0) {
      terminal.write(`\r\n❌ Command failed${PROMPT}`);
      writeInputLine(terminal);
      throw new Error(`Command failed with exit code ${exitCode}`);
    }

    // Only show completion message for non-dev-server commands
    if (!action.content.includes('npm run dev')) {
      terminal.write(`\r\n✓ Command completed${PROMPT}`);
      writeInputLine(terminal);
    }

    logger.debug(`Process terminated with code ${exitCode}`);
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') {
      unreachable('Expected file action');
    }

    const webcontainer = await this.#webcontainer;

    // Show terminal before creating file
    workbenchStore.toggleTerminal(true);

    // Wait for terminal to be ready
    const terminal = await new Promise<XTerm>((resolve) => {
      const checkTerminal = () => {
        const term = workbenchStore.terminal;
        if (term) {
          resolve(term);
        } else {
          setTimeout(checkTerminal, 100);
        }
      };
      checkTerminal();
    });

    let folder = nodePath.dirname(action.filePath);

    // remove trailing slashes
    folder = folder.replace(/\/+$/g, '');

    if (folder !== '.') {
      try {
        await webcontainer.fs.mkdir(folder, { recursive: true });
        terminal.write(`\r\nCreated folder: ${folder}`);
        logger.debug('Created folder', folder);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to create folder\n\n', error);
        terminal.write(`\r\nError creating folder: ${errorMessage}${PROMPT}`);
        writeInputLine(terminal);
        throw error;
      }
    }

    try {
      await webcontainer.fs.writeFile(action.filePath, action.content);
      terminal.write(`\r\nCreated file: ${action.filePath}\r\n✓ File operation completed${PROMPT}`);
      writeInputLine(terminal);
      logger.debug(`File written ${action.filePath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to write file\n\n', error);
      terminal.write(`\r\nError creating file: ${errorMessage}${PROMPT}`);
      writeInputLine(terminal);
      throw error;
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();
    this.actions.setKey(id, { ...actions[id], ...newState });
  }

  // Handle user input from terminal
  async handleTerminalInput(command: string) {
    if (!command) return;

    const webcontainer = await this.#webcontainer;
    const terminal = workbenchStore.terminal;
    
    if (!terminal) return;

    const process = await webcontainer.spawn('jsh', ['-c', command], {
      env: { npm_config_yes: true },
    });

    this.#currentProcess = process;

    // Set up a flag to track if we've shown the ready message
    let readyMessageShown = false;

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log(data);
          terminal.write(data);

          // Check for dev server ready message
          if (!readyMessageShown && 
              (data.includes('Local:') || data.includes('localhost:')) && 
              command.includes('npm run dev')) {
            terminal.write('\r\n✓ Development server is ready\r\n');
            readyMessageShown = true;
            writeInputLine(terminal);
          }
        },
      }),
    );

    const exitCode = await process.exit;
    this.#currentProcess = null;

    if (exitCode !== 0) {
      terminal.write(`\r\n❌ Command failed${PROMPT}`);
      writeInputLine(terminal);
    } else if (!command.includes('npm run dev')) {
      // Only show completion message for non-dev-server commands
      terminal.write(`\r\n✓ Command completed${PROMPT}`);
      writeInputLine(terminal);
    }
  }
}
