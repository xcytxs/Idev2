import React from 'react';

const EXAMPLE_PROMPTS = [
  { text: 'Build a todo app in React using Tailwind' },
  { text: 'Build a simple blog using Astro' },
  { text: 'Create a cookie consent form using Material UI' },
  { text: 'Make a space invaders game' },
  { text: 'How do I center a div?' },
];

interface ExamplePromptsProps {
  sendMessage?: (event: React.MouseEvent<HTMLButtonElement>, messageInput?: string) => void;
}

export function ExamplePrompts({ sendMessage }: ExamplePromptsProps) {
  return (
    <div id="examples" className="relative w-full max-w-2xl mx-auto mt-6 flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-2 [mask-image:linear-gradient(to_bottom,black_0%,transparent_400%)] hover:[mask-image:none] w-full border mb-12">
        {EXAMPLE_PROMPTS.map((examplePrompt, index) => (
          <button
            key={index}
            onClick={(event) => sendMessage?.(event, examplePrompt.text)}
            className="group flex items-center bg-zinc-100 dark:bg-gray-900 px-3 rounded-full gap-2 justify-center text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-theme text-sm"
          >
            {examplePrompt.text}
            <div className="i-ph:arrow-bend-down-left" />
          </button>
        ))}
      </div>
    </div>
  );
}
