export type ActionType = 'file' | 'shell';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export interface StartAction extends BaseAction {
  type: 'start';
}

export interface ToolAction extends BaseAction {
  type: 'tool';
  agentId: string;
  toolName: string;
  parameters?: Record<string, string>;
  result?: string;
  processed?: boolean;
}

export type BoltAction = FileAction | ShellAction | StartAction | ToolAction;

export type BoltActionData = BoltAction | BaseAction;
