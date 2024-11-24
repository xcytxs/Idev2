import { useStore } from '@nanostores/react';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { useState, useRef } from 'react';
import { toast } from 'react-toastify';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSmallViewport = useViewport(1024);

  const canHideChat = showWorkbench || !showChat;

  const handleSyncFiles = async () => {
    setIsSyncing(true);
    try {
      // Créer un input file pour sélectionner un fichier
      const input = document.createElement('input');
      input.type = 'file';
      // Définir les types de fichiers acceptés
      input.accept = '.js,.jsx,.ts,.tsx,.css,.scss,.html,.json,.md,.txt';
      // Désactiver la sélection multiple
      input.multiple = false;
      input.webkitdirectory = false;
      input.directory = false;

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          setIsSyncing(false);
          return;
        }

        // Vérifier si c'est un dossier (au cas où)
        if (file.size === 0 && file.type === "") {
          toast.error('Folders are not supported, please select a single file');
          setIsSyncing(false);
          return;
        }

        // Vérifier la taille du fichier (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`File "${file.name}" is too large (max 5MB)`);
          setIsSyncing(false);
          return;
        }

        try {
          console.log('Reading file:', file.name, 'Type:', file.type);
          const content = await file.text();
          
          // Vérifier si le contenu est lisible
          if (!content) {
            toast.error(`File "${file.name}" appears to be empty`);
            setIsSyncing(false);
            return;
          }

          // Vérifier l'extension du fichier
          const fileExtension = file.name.split('.').pop()?.toLowerCase();
          if (!fileExtension) {
            toast.error(`File "${file.name}" has no extension`);
            setIsSyncing(false);
            return;
          }

          const allowedExtensions = ['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'json', 'md', 'txt'];
          if (!allowedExtensions.includes(fileExtension)) {
            toast.error(`File type ".${fileExtension}" is not supported. Allowed types: ${allowedExtensions.join(', ')}`);
            setIsSyncing(false);
            return;
          }

          await workbenchStore.addFile({
            name: file.name,
            content,
            path: file.name
          });

          toast.success(`File "${file.name}" imported successfully`);
        } catch (error) {
          console.error('Error details:', {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            error
          });
          
          if (error instanceof Error) {
            toast.error(`Failed to read "${file.name}": ${error.message}`);
          } else {
            toast.error(`Failed to read "${file.name}". Please try another file.`);
          }
        } finally {
          setIsSyncing(false);
        }
      };

      input.click();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to start import process');
      setIsSyncing(false);
    }
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
          disabled={!canHideChat || isSmallViewport} // expand button is disabled on mobile as it's needed
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
        <Button
          onClick={handleSyncFiles}
          disabled={isSyncing}
          className="bg-[#FFA50015] hover:bg-[#FFA50030] relative overflow-hidden"
        >
          <div className="flex items-center">
            <div className={classNames(
              "transition-all duration-200",
              isSyncing ? "animate-spin i-ph:spinner" : "i-ph:cloud-arrow-down"
            )} />
            <span className="ml-2">{isSyncing ? 'Importing...' : 'Import'}</span>
          </div>
        </Button>
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
