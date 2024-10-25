// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { modificationsRegex } from '~/utils/diff';
import { MODEL_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="overflow-hidden pt-[4px]">
      <Markdown limitedMarkdown>{sanitizeUserMessage(content)}</Markdown>
      {content.includes('data:image') && (
        <div className="flex items-center gap-2 text-bolt-elements-textSecondary mt-2">
          <div className="i-svg-spinners:90-ring-with-bg text-xl"></div>
          <span>Analyzing image...</span>
        </div>
      )}
    </div>
  );
}

function sanitizeUserMessage(content: string) {
  // Remove base64 image data
  const sanitized = content.replace(/data:image\/[^;]+;base64,[^\n]+/g, '');
  // Remove modifications and model info
  return sanitized.replace(modificationsRegex, '').replace(MODEL_REGEX, '').trim();
}
