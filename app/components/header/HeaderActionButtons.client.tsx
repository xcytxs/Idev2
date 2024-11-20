import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { useState } from 'react';
import { toast } from 'react-toastify';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const canHideChat = showWorkbench || !showChat;

  const handleSyncFiles = () => {
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 2000);
  };

  const handlePushToGitHub = async () => {
    const repoName = prompt("Please enter a name for your new GitHub repository:", "bolt-generated-project");
    if (!repoName) {
      alert("Repository name is required. Push to GitHub cancelled.");
      return;
    }
    const githubUsername = prompt("Please enter your GitHub username:");
    if (!githubUsername) {
      alert("GitHub username is required. Push to GitHub cancelled.");
      return;
    }
    const githubToken = prompt("Please enter your GitHub personal access token:");
    if (!githubToken) {
      alert("GitHub token is required. Push to GitHub cancelled.");
      return;
    }
    
    workbenchStore.pushToGitHub(repoName, githubUsername, githubToken);
  };

  return (
    <div className="flex gap-2">
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
        <Button
          active={showChat}
          disabled={!canHideChat}
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
          className="bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3"
        >
          <div className="i-bolt:chat text-sm" />
          <span className="ml-2">Chat</span>
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
          className="bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3"
        >
          <div className="i-ph:code-bold" />
          <span className="ml-2">Editor</span>
        </Button>
      </div>

      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
        <Button
          onClick={() => workbenchStore.downloadZip()}
          className="bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3"
        >
          <div className="i-ph:download-simple" />
          <span className="ml-2">Download</span>
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <div className="relative group">
          <Button
            className="bg-[#FFA50015] hover:bg-[#FFA50030] relative overflow-hidden"
          >
            <div className="flex items-center">
              <div className="i-ph:cloud-arrow-down text-[#FFA500]" />
              <span className="ml-2">Import</span>
              <span className="ml-2 text-[10px] text-[#FFA500] opacity-60">
                Coming Soon ✨
              </span>
            </div>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100">
              <div 
                className="absolute h-full w-[30px] bg-gradient-to-r from-transparent via-[#FFA50040] to-transparent -skew-x-12 group-hover:translate-x-[150px] transition-none group-hover:transition-transform group-hover:duration-[1500ms] group-hover:ease-in-out animate-shimmer"
                style={{ 
                  left: '-30px',
                }}
              />
            </div>
          </Button>
        </div>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          onClick={handlePushToGitHub}
          className="bg-[#00FF0015] hover:bg-[#00FF0030] relative overflow-visible group"
        >
          <div className="flex items-center relative">
            <div className="i-ph:github-logo text-[#00FF00]" />
            <span className="ml-2">Push to GitHub</span>
          </div>
          <div className="fixed top-[calc(var(--header-height)/2)] -right-[15px] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" style={{ zIndex: 100000 }}>
            <span className="inline-block text-6xl transform -rotate-30 transition-transform duration-500 group-hover:translate-y-[-10px]">
              🚀
            </span>
          </div>
        </Button>
      </div>
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

function Button({ active, disabled, onClick, children, className }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center justify-center px-3 h-[34px] text-sm transition-all duration-200',
        {
          'text-bolt-elements-textPrimary': active,
          'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary': !active,
          'opacity-50 cursor-not-allowed': disabled,
        },
        className
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
