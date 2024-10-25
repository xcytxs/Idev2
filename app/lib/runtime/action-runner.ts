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
          terminal.write(`\r\nError: ${errorMessage}\r\n`);
        }
      });
  }

  async #executeAction(actionId: string) {
    const action = this.actions.get()[actionId];

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

      this.#updateAction(actionId, { status: action.abortSignal.aborted ? 'aborted' : 'complete' });
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

    // Display the command being executed
    terminal.write(`\r\n$ ${action.content}\r\n`);

    const process = await webcontainer.spawn('jsh', ['-c', action.content], {
      env: { npm_config_yes: true },
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log(data);
          terminal.write(data);
        },
      }),
    );

    const exitCode = await process.exit;

    if (exitCode !== 0) {
      throw new Error(`Command failed with exit code ${exitCode}`);
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
        terminal.write(`\r\nCreated folder: ${folder}\r\n`);
        logger.debug('Created folder', folder);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to create folder\n\n', error);
        terminal.write(`\r\nError creating folder: ${errorMessage}\r\n`);
        throw error;
      }
    }

    try {
      await webcontainer.fs.writeFile(action.filePath, action.content);
      terminal.write(`\r\nCreated file: ${action.filePath}\r\n`);
      logger.debug(`File written ${action.filePath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to write file\n\n', error);
      terminal.write(`\r\nError creating file: ${errorMessage}\r\n`);
      throw error;
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState });
  }
}
