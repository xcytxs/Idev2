import { memo, useEffect, useState } from 'react';
import { bundledLanguages, codeToHtml, isSpecialLang, type BundledLanguage, type SpecialLanguage } from 'shiki';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

import styles from './CodeBlock.module.scss';

const logger = createScopedLogger('CodeBlock');

interface CodeBlockProps {
  className?: string;
  code: string;
  language?: BundledLanguage | SpecialLanguage;
  theme?: 'light-plus' | 'dark-plus';
  disableCopy?: boolean;
}

export const CodeBlock = memo(
  ({ className, code, language = 'plaintext', theme = 'dark-plus', disableCopy = false }: CodeBlockProps) => {
    const [html, setHTML] = useState<string | undefined>(undefined);
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
      if (copied) {
        return;
      }

      navigator.clipboard.writeText(code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    };

    useEffect(() => {
      if (language && !isSpecialLang(language) && !(language in bundledLanguages)) {
        logger.warn(`Unsupported language '${language}'`);
      }

      logger.trace(`Language = ${language}`);

      const processCode = async () => {
        setHTML(await codeToHtml(code, { lang: language, theme }));
      };

      processCode();
    }, [code]);

    return (
      <div className={classNames('relative group text-left', className)}>
        <div
          className={classNames(
            styles.CopyButtonContainer,
            'bg-gray-600 dark:bg-gray-700/50 absolute top-[10px] right-[10px] rounded-md z-10 text-lg flex items-center justify-center opacity-0 group-hover:opacity-100',
            {
              'rounded-l-0 opacity-100 bg-green-700/80': copied,
            },
          )}
        >
          {!disableCopy && (
            <button
              className={classNames(
                'flex items-center bg-transparent p-[6px] justify-center before:bg-green-800/40 before:rounded-l-md before:text-green-300',
                {
                  'before:opacity-0': !copied,
                  'before:opacity-100': copied,
                },
              )}
              title="Copy Code"
              onClick={() => copyToClipboard()}
            >
              <div className="i-ph:clipboard-text-duotone text-white dark:text-gray-300"></div>
            </button>
          )}
        </div>
        <div dangerouslySetInnerHTML={{ __html: html ?? '' }}></div>
      </div>
    );
  },
);
