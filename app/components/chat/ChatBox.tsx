import type { ModelInfo, ProviderInfo } from '~/utils/types';
import React from 'react';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { APIKeyManager } from '~/components/chat/APIKeyManager';
import { SendButton } from '~/components/chat/SendButton.client';
import { IconButton } from '~/components/ui/IconButton';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { ClientOnly } from 'remix-utils/client-only';
import { ModelSelector } from '~/components/chat/ModelSelector';

const TEXTAREA_MIN_HEIGHT = 76;

export interface ChatBoxProps {
  chatStarted: boolean;
  provider: ProviderInfo | undefined;
  modelList: ModelInfo[];
  model: string | undefined;
  setModel: ((model: string) => void) | undefined;
  setProvider: ((provider: ProviderInfo) => void) | undefined;
  apiKeys: Record<string, string>;
  updateApiKey: (provider: string, key: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement> | undefined;
  sendMessage: ((event: React.UIEvent, messageInput?: string) => void) | undefined;
  input: string;
  handleInputChange: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  textAreaMaxHeight: number;
  isStreaming: boolean;
  handleStop: (() => void) | undefined;
  enhancingPrompt: boolean;
  promptEnhanced: boolean;
  enhancePrompt: (() => void) | undefined;
  exportChat: (() => void) | undefined;
}

export function ChatBox({
  chatStarted,
  provider,
  modelList,
  model,
  setModel,
  setProvider,
  apiKeys,
  updateApiKey,
  textareaRef,
  sendMessage,
  input,
  handleInputChange,
  textAreaMaxHeight,
  isStreaming,
  handleStop,
  enhancingPrompt,
  promptEnhanced,
  enhancePrompt,
  exportChat,
}: ChatBoxProps) {
  return (
    <div
      className={classNames(
        ' bg-bolt-elements-background-depth-2 p-3 rounded-lg border border-bolt-elements-borderColor relative w-full max-w-chat mx-auto z-prompt mb-6',
        {
          'sticky bottom-2': chatStarted,
        },
      )}
    >
      <ModelSelector
        key={provider?.name + ':' + modelList.length}
        model={model}
        setModel={setModel}
        modelList={modelList}
        provider={provider}
        setProvider={setProvider}
        providerList={PROVIDER_LIST}
      />

      {provider && (
        <APIKeyManager
          provider={provider as ProviderInfo}
          apiKey={provider?.name ? apiKeys[provider.name] || '' : ''}
          setApiKey={(key) => provider?.name && updateApiKey(provider.name, key)}
        />
      )}

      <div
        className={classNames(
          'shadow-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-lg overflow-hidden transition-all',
        )}
      >
        <textarea
          ref={textareaRef}
          className={`w-full pl-4 pt-4 pr-16 focus:outline-none focus:ring-0 focus:border-none focus:shadow-none resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent transition-all`}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (event.shiftKey) {
                return;
              }

              event.preventDefault();

              if (sendMessage) {
                sendMessage(event);
              }
            }
          }}
          value={input}
          onChange={(event) => {
            handleInputChange?.(event);
          }}
          style={{
            minHeight: TEXTAREA_MIN_HEIGHT,
            maxHeight: textAreaMaxHeight,
          }}
          placeholder="How can Bolt help you today?"
          translate="no"
        />
        <ClientOnly>
          {() => (
            <SendButton
              show={input.length > 0 || isStreaming}
              isStreaming={isStreaming}
              onClick={(event) => {
                if (isStreaming) {
                  handleStop?.();
                  return;
                }

                if (sendMessage) {
                  sendMessage(event);
                }
              }}
            />
          )}
        </ClientOnly>
        <div className="flex justify-between items-center text-sm p-4 pt-2">
          <div className="flex gap-1 items-center">
            <IconButton
              title="Enhance prompt"
              disabled={input.length === 0 || enhancingPrompt}
              className={classNames('transition-all', {
                'opacity-100!': enhancingPrompt,
                'text-bolt-elements-item-contentAccent! pr-1.5 enabled:hover:bg-bolt-elements-item-backgroundAccent!':
                  promptEnhanced,
              })}
              onClick={() => enhancePrompt?.()}
            >
              {enhancingPrompt ? (
                <>
                  <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
                  <div className="ml-1.5">Enhancing prompt...</div>
                </>
              ) : (
                <>
                  <div className="i-bolt:stars text-xl"></div>
                  {promptEnhanced && <div className="ml-1.5">Prompt enhanced</div>}
                </>
              )}
            </IconButton>
            {chatStarted && <ClientOnly>{() => <ExportChatButton exportChat={exportChat} />}</ClientOnly>}
          </div>
          {input.length > 3 ? (
            <div className="text-xs text-bolt-elements-textTertiary">
              Use <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Shift</kbd> +{' '}
              <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Return</kbd> for a new line
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
