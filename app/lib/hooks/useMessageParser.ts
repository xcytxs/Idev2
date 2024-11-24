import type { Message } from 'ai';
import { useCallback, useState } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';
import { AgentOutputParser } from '../agents/agent-output-parser';
import { agentRegistry } from '~/utils/agentFactory';
import type { ToolAction } from '~/types/actions';

const logger = createScopedLogger('useMessageParser');

const agentOutputParser = new AgentOutputParser({
  onToolCallStart: (event) => {

    logger.trace('onToolCallStart', event);
    let artifactData = {
      messageId: event.messageId,
      title: `Agent: ${agentRegistry[event.agentId]?.getConfig().name}`,
      id: event.id
    }
    workbenchStore.addArtifact(artifactData);
  },
  onToolCallComplete: (event) => {
    logger.trace('onToolCallComplete', event);
    let artifactData = {
      messageId: event.messageId,
      title: `Agent: ${agentRegistry[event.agentId]?.getConfig().name}`,
      id: event.id
    }

    let actionData: ToolAction = {
      type: 'tool',
      agentId: event.agentId,
      toolName: event.name,
      content: JSON.stringify(event.parameters),
      parameters: event.parameters,
      processed: event.processed
    }
    
    workbenchStore.addAction({
      messageId: event.messageId,
      actionId: event.id,
      artifactId: event.id,
      action: actionData
    });

    workbenchStore.runAction({
      messageId: event.messageId,
      actionId: event.id,
      artifactId: event.id,
      action: actionData
    })
    workbenchStore.updateArtifact(artifactData, { closed: true})
  },

});
const messageParser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      workbenchStore.showWorkbench.set(true);
      workbenchStore.addArtifact(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      workbenchStore.updateArtifact(data, { closed: true });
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);

      // we only add shell actions when when the close tag got parsed because only then we have the content
      if (data.action.type !== 'shell') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);

      if (data.action.type === 'shell') {
        workbenchStore.addAction(data);
      }

      workbenchStore.runAction(data);
    },
    onActionStream: (data) => {
      logger.trace('onActionStream', data.action);
      workbenchStore.runAction(data, true);
    },
  },
  agentOutputParser
});



export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
      agentOutputParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant') {
        const newParsedContent = messageParser.parse(message.id, message.content,message.annotations);

        setParsedMessages((prevParsed) => ({
          ...prevParsed,
          [index]: !reset ? (prevParsed[index] || '') + newParsedContent : newParsedContent,
        }));
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
