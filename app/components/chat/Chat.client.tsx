// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';
import { DEFAULT_MODEL } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import { ImageUpload } from './ImageUpload';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(new Error(`Failed to read image: ${error.message}`));
  });
}

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();

  return (
    <>
      {ready && <ChatImpl initialMessages={initialMessages} storeMessageHistory={storeMessageHistory} />}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }
          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
    </>
  );
}

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

export const ChatImpl = memo(({ initialMessages, storeMessageHistory }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const { showChat } = useStore(chatStore);

  const [animationScope, animate] = useAnimate();

  const { messages, isLoading, input, handleInputChange, setInput, stop, append } = useChat({
    api: '/api/chat',
    onError: (error) => {
      logger.error('Chat API Error:', error);
      let errorMessage = 'An error occurred';
      
      if (error instanceof Error) {
        if (error.message.includes('413')) {
          errorMessage = `Message too large. Try reducing content or image size.`;
        } else if (error.message.includes('429')) {
          errorMessage = 'Too many requests. Please wait a moment.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Server might be busy.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection.';
        } else if (error.message.includes('memory')) {
          errorMessage = 'Server memory limit reached. Try a smaller image.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      toast.error(errorMessage);
    },
    onFinish: () => {
      logger.debug('Chat finished streaming');
    },
    initialMessages,
  });

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  useEffect(() => {
    chatStore.setKey('started', initialMessages.length > 0);
  }, []);

  useEffect(() => {
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => {
        logger.error('Failed to store message history:', error);
        toast.error('Failed to save chat history');
      });
    }
  }, [messages, isLoading, parseMessages]);

  const scrollTextArea = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  const abort = () => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
  };

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [input, textareaRef]);

  const runAnimation = async () => {
    if (chatStarted) {
      return;
    }

    await Promise.all([
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    chatStore.setKey('started', true);

    setChatStarted(true);
  };

  const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
    const _input = messageInput || input;

    if ((_input.length === 0 && !imageFile) || isLoading || isProcessingImage) {
      return;
    }

    try {
      await workbenchStore.saveAllFiles();

      const fileModifications = workbenchStore.getFileModifcations();

      chatStore.setKey('aborted', false);

      runAnimation();

      let messageContent = `[Model: ${model}]\n\n`;

      if (fileModifications !== undefined) {
        const diff = fileModificationsToHTML(fileModifications);
        messageContent += `${diff}\n\n`;
      }

      messageContent += _input;

      if (imageFile) {
        setIsProcessingImage(true);
        try {
          logger.debug(`Processing image: ${imageFile.name} (${formatBytes(imageFile.size)})`);
          const base64Image = await getBase64(imageFile);
          const base64Size = base64Image.length * 0.75;
          
          if (base64Size > MAX_MESSAGE_SIZE) {
            throw new Error(`Image too large after encoding (${formatBytes(base64Size)}). Please use a smaller image.`);
          }
          
          messageContent += `\n\n${base64Image}`;
          logger.debug('Image processed successfully');
        } catch (error) {
          logger.error('Image processing error:', error);
          throw new Error(`Failed to process image: ${error.message}`);
        }
      }

      const messageSize = new Blob([messageContent]).size;
      if (messageSize > MAX_MESSAGE_SIZE) {
        throw new Error(`Message size (${formatBytes(messageSize)}) exceeds limit (${formatBytes(MAX_MESSAGE_SIZE)})`);
      }

      append({ 
        role: 'user', 
        content: messageContent
      });

      if (fileModifications !== undefined) {
        workbenchStore.resetAllFileModifications();
      }

      setInput('');
      setImageFile(null);
      resetEnhancer();
      textareaRef.current?.blur();
    } catch (error) {
      logger.error('Error sending message:', error);
      toast.error(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const [messageRef, scrollRef] = useSnapScroll();

  const handleImageUpload = (file: File) => {
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }

      if (file.size > MAX_IMAGE_SIZE) {
        throw new Error(`Image size (${formatBytes(file.size)}) exceeds limit (${formatBytes(MAX_IMAGE_SIZE)})`);
      }

      setImageFile(file);
      toast.success(`Image "${file.name}" attached`);
    } catch (error) {
      logger.error('Image upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    }
  };

  return (
    <BaseChat
      ref={animationScope}
      textareaRef={textareaRef}
      input={input}
      showChat={showChat}
      chatStarted={chatStarted}
      isStreaming={isLoading || isProcessingImage}
      enhancingPrompt={enhancingPrompt}
      promptEnhanced={promptEnhanced}
      sendMessage={sendMessage}
      model={model}
      setModel={setModel}
      messageRef={messageRef}
      scrollRef={scrollRef}
      handleInputChange={handleInputChange}
      handleStop={abort}
      messages={messages.map((message, i) => {
        if (message.role === 'user') {
          return message;
        }

        return {
          ...message,
          content: parsedMessages[i] || '',
        };
      })}
      enhancePrompt={() => {
        enhancePrompt(input, (input) => {
          setInput(input);
          scrollTextArea();
        });
      }}
      imageFile={imageFile}
      onImageUpload={handleImageUpload}
      isProcessingImage={isProcessingImage}
    />
  );
});
