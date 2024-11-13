import type { JSONValue, Message, ToolInvocation } from 'ai';
import React from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { ToolMessage } from './ToolMessage';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  addToolResult?: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const { id, isStreaming = false, messages = [], addToolResult } = props;

  return (
    <div id={id} ref={ref} className={props.className}>
      {messages.length > 0
        ? messages.map((message, index) => {
            const { role, content } = message;
            const isUserMessage = role === 'user';
            const isFirst = index === 0;
            const isLast = index === messages.length - 1;
            if (message.annotations) {
              let isHidden = message.annotations.find((annotation: JSONValue) => {
                if (typeof annotation !== 'object' || typeof annotation?.length === 'number') return false;
                let object = annotation as any;
                return object.visibility === 'hidden';
              });
              console.log('isHidden', isHidden, message);

              if (isHidden) return <></>;
            }
            return (
              <div
                key={index}
                className={classNames('flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)]', {
                  'bg-bolt-elements-messages-background': isUserMessage || !isStreaming || (isStreaming && !isLast),
                  'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent':
                    isStreaming && isLast,
                  'mt-4': !isFirst,
                })}
              >
                {role === 'user' && (
                  <div className="flex items-center justify-center w-[34px] h-[34px] overflow-hidden bg-white text-gray-600 rounded-full shrink-0 self-start">
                    <div className="i-ph:user-fill text-xl"></div>
                  </div>
                )}
                <div className="grid grid-col-1 w-full">
                  {role === 'user' ? (
                    <UserMessage content={content} />
                  ) : (
                    <>
                      {message.toolInvocations?.map((toolInvocation: ToolInvocation) => {
                        return (
                          <ToolMessage
                            key={toolInvocation.toolCallId}
                            content={toolInvocation}
                            data={message.data}
                            addToolResult={addToolResult}
                          />
                        );
                      })}
                      <AssistantMessage content={content} />
                    </>
                  )}
                </div>
              </div>
            );
          })
        : null}
      {isStreaming && (
        <div className="text-center w-full text-bolt-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
      )}
    </div>
  );
});
