/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { modificationsRegex } from '~/utils/diff';
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  const modelMatch = content.match(MODEL_REGEX);
  const modelInfo = modelMatch ? `Using: ${modelMatch[1]}` : '';

  const sanitizedContent = sanitizeUserMessage(content);

  return (
    <div className="overflow-hidden">
      {modelInfo && <p className='dark:text-zinc-500 text-xs mb-1'>{modelInfo}</p>}
      <Markdown limitedMarkdown>{sanitizedContent}</Markdown>
    </div>
  );
}

function sanitizeUserMessage(content: string) {
  return content.replace(modificationsRegex, '').replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').trim();
}
