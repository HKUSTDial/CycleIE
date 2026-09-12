import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import DnsIcon from '@mui/icons-material/Dns'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DescriptionIcon from '@mui/icons-material/Description';
import InsightsIcon from '@mui/icons-material/Insights';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import HistoryIcon from '@mui/icons-material/History';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { alpha } from '@mui/material/styles';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import HomeIcon from '@mui/icons-material/Home';

import ChatInput from './ChatInput';
import ChatMessages, { Message } from './components/ChatMessages';
import FileLibraryWithUpload from './components/FileLibraryWithUpload';
import WorkflowViewer from './components/WorkflowViewer';
import FileContentViewer from './components/FileContentViewer';
import ChatHistoryPanel from './components/ChatHistoryPanel';
import './styles/App.css';

const typewriterStyles = document.createElement('style');
typewriterStyles.textContent = `
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.typewriter-cursor {
  animation: blink 1s infinite;
}
`;
document.head.appendChild(typewriterStyles);

// File interface
interface UploadedFile {
  filename: string;
  filepath: string;
  size: number;
  selected?: boolean;  // New property to track selection
}

// Model options
const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', category: 'gpt' },
  { value: 'gpt-4o-mini', label: 'GPT-4o-mini', category: 'gpt' },
  { value: 'o1', label: 'o1', category: 'gpt' },
  { value: 'deepseek-v3', label: 'DeepSeek-V3', category: 'deepseek' },
  { value: 'deepseek-r1', label: 'DeepSeek-R1', category: 'deepseek' },
  { value: 'claude-3-5-sonnet', label: 'Claude-3.5-Sonnet', category: 'claude' },
  { value: 'qwen-max', label: 'Qwen-Max', category: 'qianwen' },
  { value: 'qwen-long', label: 'Qwen-Long', category: 'qianwen' },
  { value: 'qwen-turbo', label: 'Qwen-Turbo', category: 'qianwen' },
  { value: 'settings', label: 'Settings', category: 'settings' },
];

// Create a STORM-inspired modern theme
// App props interface
interface AppProps {
  projectId?: string;
  projectName?: string;
  onGoHome?: () => void;
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',      // Modern blue like STORM
      light: '#3b82f6',     
      dark: '#1d4ed8',      
    },
    secondary: {
      main: '#64748b',      // Elegant slate gray
      light: '#94a3b8',     
      dark: '#475569',      
    },
    background: {
      default: '#ffffff',   // Pure white background
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',   // Deep slate for text
      secondary: '#64748b', // Medium slate for secondary text
    },
    divider: '#e2e8f0',
    success: {
      main: '#059669',      
    },
    warning: {
      main: '#d97706',      
    },
    error: {
      main: '#dc2626',      
    },
    info: {
      main: '#0284c7',      
    },
    grey: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    h4: {
      fontWeight: 700,
      fontSize: '1.875rem',
      letterSpacing: '-0.025em',
      color: '#0f172a',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '1rem',
      letterSpacing: '0em',
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: '#475569',
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      color: '#64748b',
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0em',
    },
  },
  shape: {
    borderRadius: 8,  // STORM uses moderate rounded corners
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#ffffff',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f5f9',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#cbd5e1',
            borderRadius: '3px',
            '&:hover': {
              background: '#94a3b8',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: 'none',
          backgroundImage: 'none',
          '&.chat-messages-container': {
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
          },
          '&.multibox-root': {
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
          },
          '&.drag-overlay': {
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              borderRadius: '8px',
              border: '2px dashed #2563eb',
              zIndex: 1000,
              backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
            }
          },
        },
        elevation1: {
          boxShadow: 'none',
          border: 'none',
          backgroundImage: 'none',
        },
        elevation2: {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: '6px',
          boxShadow: 'none',
          padding: '8px 16px',
          fontSize: '0.875rem',
          '&:hover': {
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          },
          transition: 'all 0.15s ease',
        },
        contained: {
          background: '#2563eb',
          color: '#ffffff',
          '&:hover': {
            background: '#1d4ed8',
            boxShadow: '0 4px 6px -1px rgb(37 99 235 / 0.1), 0 2px 4px -2px rgb(37 99 235 / 0.1)',
          },
        },
        outlined: {
          borderColor: '#e2e8f0',
          color: '#475569',
          '&:hover': {
            borderColor: '#cbd5e1',
            backgroundColor: '#f8fafc',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            fontSize: '0.875rem',
            '& fieldset': {
              borderColor: '#e2e8f0',
              borderWidth: '1px',
            },
            '&:hover fieldset': {
              borderColor: '#cbd5e1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#2563eb',
              borderWidth: '2px',
            },
            '&.Mui-disabled': {
              backgroundColor: '#f8fafc',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#64748b',
            fontSize: '0.875rem',
            '&.Mui-focused': {
              color: '#2563eb',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          fontWeight: 500,
          fontSize: '0.75rem',
          height: '24px',
          '& .MuiChip-deleteIcon': {
            fontSize: '16px',
            '&:hover': {
              color: '#dc2626',
            },
          },
        },
        colorPrimary: {
          backgroundColor: '#dbeafe',
          color: '#1d4ed8',
          '&:hover': {
            backgroundColor: '#bfdbfe',
          },
        },
        colorSecondary: {
          backgroundColor: '#f1f5f9',
          color: '#475569',
          '&:hover': {
            backgroundColor: '#e2e8f0',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          padding: '8px',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: '#f1f5f9',
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: '#2563eb',
            '& + .MuiSwitch-track': {
              backgroundColor: '#2563eb',
            },
          },
        },
      },
    },
  },
});

const App: React.FC<AppProps> = ({ projectId, projectName, onGoHome }) => {
  const indexUrl = projectId ? `/api/projects/${projectId}/reload-index` : '/api/reload-index';
  const overwriteUrl = projectId
    ? `/api/projects/${projectId}/upload/confirm-overwrite`
    : '/api/upload/confirm-overwrite';
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  
  // Overwrite confirmation dialog state
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState<boolean>(false);
  const [fileToOverwrite, setFileToOverwrite] = useState<File | null>(null);
  const [fileOverwritePath, setFileOverwritePath] = useState<string>('');

  // Add state for index reload operation
  const [isReloadingIndex, setIsReloadingIndex] = useState<boolean>(false);

  // Add new state for the abort controller
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // CycleIE-related state
  const [cycleIEEnabled, setCycleIEEnabled] = useState<boolean>(false);

  // Document library panel collapsed state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);

  // Right sidebar state
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(true);
  const [rightPanelType, setRightPanelType] = useState<'reader' | 'workflow'>('reader');
  const [selectedFileForReading, setSelectedFileForReading] = useState<string | null>(null);
  const [currentThoughtProcess, setCurrentThoughtProcess] = useState<string[] | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(500); // Wider default width
  const [isResizing, setIsResizing] = useState<boolean>(false);

  
  // Chat history state
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState<number>(0);
  
  // Left panel type toggle state
  const [leftPanelType, setLeftPanelType] = useState<'files' | 'history'>('files');

  // Add new state for unified drag operation
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Model selection state - ensure the initial value is valid
  const [currentModel, setCurrentModel] = useState<string>('gpt-4o');

  // Helper: validate and normalize the model value
  const normalizeModelValue = (modelValue: string): string => {
    if (!modelValue) return 'gpt-4o';
    
    // Check whether the model is one of the options (excluding the settings item)
    const isValidModel = MODEL_OPTIONS.some(option => 
      option.value === modelValue && option.value !== 'settings'
    );
    
    return isValidModel ? modelValue : 'gpt-4o';
  };

  // Settings modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Supported file formats
  const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'md', 'csv', 'xlsx', 'xls', 'docx'];

  // Validate the file format
  const isValidFile = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return SUPPORTED_EXTENSIONS.includes(extension);
  };

  // Recursively process a folder's contents
  const processDirectoryEntry = async (dirEntry: any): Promise<File[]> => {
    const files: File[] = [];
    
    const readEntries = (dirReader: any): Promise<any[]> => {
      return new Promise((resolve) => {
        dirReader.readEntries((entries: any[]) => {
          resolve(entries);
        });
      });
    };

    const dirReader = dirEntry.createReader();
    const entries = await readEntries(dirReader);
    
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => {
          entry.file((file: File) => resolve(file));
        });
        if (isValidFile(file)) {
          files.push(file);
        }
      } else if (entry.isDirectory) {
        // Recursively process subdirectories
        const subFiles = await processDirectoryEntry(entry);
        files.push(...subFiles);
      }
    }
    
    return files;
  };

  // Fetch already uploaded files when the app loads
  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  // Fetch current model when app loads
  useEffect(() => {
    fetchCurrentModel();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-dismiss system messages after 2 seconds
  useEffect(() => {
    // Find system messages in the message list
    const systemMessages = messages.filter(message => message.role === 'system');
    
    if (systemMessages.length === 0) return;
    
    // Create a map to track timeouts for each system message
    const timeoutIds: NodeJS.Timeout[] = [];
    
    // For each system message, set a timeout to remove it after 2 seconds
    systemMessages.forEach(systemMessage => {
      const timeoutId = setTimeout(() => {
        setMessages(prevMessages => 
          prevMessages.filter(message => 
            // Keep all non-system messages and system messages that are not this one
            message.role !== 'system' || message.timestamp !== systemMessage.timestamp
          )
        );
      }, 2000);
      
      timeoutIds.push(timeoutId);
    });
    
    // Cleanup timeouts on unmount or when messages change
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchUploadedFiles = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/files`);
      setUploadedFiles(response.data.files);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFilesUpload = async (files: File[]) => {
    const newUploadedFiles: UploadedFile[] = [];
    const newMessages: Message[] = [];
    
    // Add a status message for the start of the upload
    const uploadStatusMessage: Message = {
      role: 'system',
      content: '',
      timestamp: new Date().toISOString(),
      uploading: true,
      uploadProgress: {
        total: files.length,
        completed: 0,
        current: undefined
      }
    };
    
    // Show the upload status message immediately
    setMessages(prev => [...prev, uploadStatusMessage]);
    
    // Update the upload status message
    const updateUploadProgress = (completed: number, current?: string) => {
      setMessages(prev => prev.map(msg => 
        msg.uploading && msg.uploadProgress ? {
          ...msg,
          uploadProgress: {
            ...msg.uploadProgress,
            completed,
            current
          }
        } : msg
      ));
    };
    
    // Remove the upload status message
    const removeUploadMessage = () => {
      setMessages(prev => prev.filter(msg => !msg.uploading));
    };
    
    // Batch-upload when there are 5 or more files
    if (files.length >= 5) {
      
      try {
        updateUploadProgress(0, `Preparing to upload ${files.length} files...`);
        
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });
        
        updateUploadProgress(0, 'Uploading files...');
        
        const response = await axios.post(`/api/projects/${projectId}/upload/batch`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        if (response.data.status === 'success' || response.data.status === 'partial') {
          updateUploadProgress(files.length, 'Processing upload results...');
          
          // Handle successfully uploaded files
          response.data.uploaded.forEach((fileInfo: any) => {
            newUploadedFiles.push({
              filename: fileInfo.filename,
              filepath: fileInfo.filepath,
              size: fileInfo.size
            });
          });
          
          // Add a batch-upload success message
          if (response.data.uploaded.length > 0) {
            newMessages.push({
              role: 'system',
              content: `Batch upload succeeded: ${response.data.uploaded.length} files were uploaded and selected for QA`,
              timestamp: new Date().toISOString()
            });
          }
          
          // Handle files that failed to upload
          if (response.data.failed && response.data.failed.length > 0) {
            newMessages.push({
              role: 'system',
              content: `Some files failed to upload: ${response.data.failed.length} files (unsupported format or another error)`,
              timestamp: new Date().toISOString()
            });
            console.warn('Files that failed during batch upload:', response.data.failed);
          }
        }
      } catch (error) {
        console.error('Batch upload failed:', error);
        const errorMessage = axios.isAxiosError(error) 
          ? error.response?.data?.error || error.message
          : String(error);
          
        removeUploadMessage(); // Remove the upload status message
        newMessages.push({
          role: 'system',
          content: `Batch upload failed: ${errorMessage}`,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // Use the existing one-by-one upload logic for a small number of files
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        updateUploadProgress(i, `Uploading file: ${file.name}`);
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const response = await axios.post(`/api/projects/${projectId}/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          
          // Check if the file already exists
          if (response.status === 409 && response.data.status === 'exists') {
            // Save the current file for overwrite confirmation
            setFileToOverwrite(file);
            setFileOverwritePath(response.data.filepath);
            setOverwriteConfirmOpen(true);
            
            // Add message about duplicate file
            newMessages.push({
              role: 'system',
              content: `File "${file.name}" already exists. Please confirm if you want to overwrite it.`,
              timestamp: new Date().toISOString()
            });
            
            // Skip to the next file
            continue;
          }
          
          // Add to the new files array
          newUploadedFiles.push({
            filename: response.data.filename,
            filepath: response.data.filepath,
            size: file.size
          });
          
          // Update progress
          updateUploadProgress(i + 1, i === files.length - 1 ? 'Upload complete' : undefined);
          
          // Add to new messages array
          newMessages.push({
            role: 'system',
            content: `File "${file.name}" uploaded successfully and selected for QA.`,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          // Check if this is the special 409 Conflict status
          if (axios.isAxiosError(error) && error.response?.status === 409) {
            // Save the current file for overwrite confirmation
            setFileToOverwrite(file);
            setFileOverwritePath(error.response.data.filepath);
            setOverwriteConfirmOpen(true);
            
            // Add message about duplicate file
            newMessages.push({
              role: 'system',
              content: `File "${file.name}" already exists. Please confirm if you want to overwrite it.`,
              timestamp: new Date().toISOString()
            });
          } else {
            console.error('Error uploading file:', error);
            const errorMessage = axios.isAxiosError(error) 
              ? error.response?.data?.error || error.message
              : String(error);
              
            newMessages.push({
              role: 'system',
              content: `Error uploading file: ${errorMessage}`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
    
    // Update state once with all new files
    if (newUploadedFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
      
      // Select newly uploaded files by default
      setSelectedFiles(prev => [...prev, ...newUploadedFiles]);
      
      // Reload the Faiss index to include the new files
      setIsReloadingIndex(true);
      try {
        await axios.post(indexUrl);
        // We don't need an additional message since we already showed upload success messages
      } catch (error) {
        console.error('Error reloading index after file upload:', error);
        // Show warning message
        newMessages.push({
          role: 'system',
          content: 'Warning: Faiss index may be out of sync after file upload.',
          timestamp: new Date().toISOString()
        });
      } finally {
        setIsReloadingIndex(false);
      }
    }
    
    // Remove the upload status message
    removeUploadMessage();
    
    // Update messages once with all new messages
    if (newMessages.length > 0) {
      setMessages(prev => [...prev, ...newMessages]);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    // Set the file to delete and open confirmation dialog
    setFileToDelete(fileId);
    setDeleteConfirmOpen(true);
  };
  
  const confirmFileDelete = async () => {
    // Close the dialog
    setDeleteConfirmOpen(false);
    
    if (!fileToDelete) return;
    
    try {
      const fileToDeleteObj = uploadedFiles.find(file => file.filepath === fileToDelete);
      
      if (!fileToDeleteObj) {
        console.error('File not found:', fileToDelete);
        return;
      }
      
      await axios.post(`/api/projects/${projectId}/files/delete`, {
        filepath: fileToDeleteObj.filepath
      });
      
      // Remove the file from the list
      setUploadedFiles(uploadedFiles.filter(file => file.filepath !== fileToDelete));
      setSelectedFiles(selectedFiles.filter(file => file.filepath !== fileToDelete));
      
      // Add a system message about the deletion
      setMessages([...messages, {
        role: 'system',
        content: `File "${fileToDeleteObj.filename}" deleted successfully.`,
        timestamp: new Date().toISOString()
      }]);
      
      // Reset the file to delete
      setFileToDelete(null);
      
      // Reload the Faiss index to keep it in sync
      setIsReloadingIndex(true);
      try {
        await axios.post(indexUrl);
        // We don't need to show this message since we already showed file deletion success
      } catch (error) {
        console.error('Error reloading index after file deletion:', error);
        // Show warning message
        setMessages(prevMessages => [
          ...prevMessages,
          {
            role: 'system',
            content: 'Warning: Faiss index may be out of sync after file deletion.',
            timestamp: new Date().toISOString()
          }
        ]);
      } finally {
        setIsReloadingIndex(false);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      const errorMessage = axios.isAxiosError(error) 
        ? error.response?.data?.error || error.message
        : String(error);
        
      setMessages([...messages, {
        role: 'system',
        content: `Error deleting file: ${errorMessage}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };
  
  const cancelFileDelete = () => {
    // Close the dialog and reset the file to delete
    setDeleteConfirmOpen(false);
    setFileToDelete(null);
  };

  // Select all / deselect all
  const handleSelectAll = () => {
    if (selectedFiles.length === uploadedFiles.length) {
      // If everything is already selected, clear the selection
      setSelectedFiles([]);
    } else {
      // Otherwise select every file
      setSelectedFiles([...uploadedFiles]);
    }
  };

  const toggleFileSelection = (filepath: string) => {
    const fileIndex = uploadedFiles.findIndex(file => file.filepath === filepath);
    
    if (fileIndex === -1) return;
    
    const file = uploadedFiles[fileIndex];
    const isCurrentlySelected = selectedFiles.some(f => f.filepath === filepath);
    
    if (isCurrentlySelected) {
      // Remove from selected files
      setSelectedFiles(selectedFiles.filter(f => f.filepath !== filepath));
    } else {
      // Add to selected files
      setSelectedFiles([...selectedFiles, file]);
    }
  };

  // New handler for pausing generation
  const handlePauseGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsProcessing(false);
      
      // Mark the last message as no longer thinking
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.thinking) {
          lastMessage.thinking = false;
          
          // Keep the thought process
          if (!lastMessage.thoughtProcess) {
            lastMessage.thoughtProcess = [];
          }
        }
        return newMessages;
      });
      
      // Add a system message indicating the generation was paused
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: 'Generation paused by user.',
          timestamp: new Date().toISOString()
        }
      ]);
    }
  };

  // Remove a file from the selection list (does not delete the file)
  const handleFileRemove = (filename: string) => {
    // Remove the named file from selectedFiles
    setSelectedFiles(prevSelected => 
      prevSelected.filter(file => file.filename !== filename)
    );
  };

  // Handle the CycleIE toggle
  const handleCycleIEToggle = (enabled: boolean) => {
    setCycleIEEnabled(enabled);
    // Do not force a switch to the document reader, so the workflow button stays available
  };

  // Collapse or expand the document library panel
  const handlePanelToggle = () => {
    setIsPanelCollapsed(!isPanelCollapsed);
  };

  // Collapse or expand the file reader panel
  const handleRightPanelToggle = () => {
    setIsRightPanelCollapsed(!isRightPanelCollapsed);
  };

  // Open a file in the reader
  const handleFileRead = (filepath: string) => {
    setSelectedFileForReading(filepath);
    setRightPanelType('reader');
    setIsRightPanelCollapsed(false);  // Expand the reader automatically
  };

  // Close the workflow viewer
  const handleCloseWorkflow = () => {
    // Do not clear currentThoughtProcess; only collapse the panel
    setIsRightPanelCollapsed(true);
  };

  // Handle a click on thinking progress
  const handleThinkingProgressClick = (messageIndex?: number) => {
    // If a message index is provided, use that message's thought process
    if (messageIndex !== undefined) {
      const message = messages[messageIndex];
      if (message && message.role === 'assistant' && message.thoughtProcess) {
        setCurrentThoughtProcess(message.thoughtProcess);
      }
    }
    setRightPanelType('workflow');
    setIsRightPanelCollapsed(false);
  };

  // Resize the right sidebar
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = window.innerWidth - e.clientX;
    // Clamp to the minimum and maximum width
    const minWidth = 500;
    const maxWidth = 1200;
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setRightPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Switch the left panel type
  const handleLeftPanelTypeChange = (newType: 'files' | 'history') => {
    setLeftPanelType(newType);
    // If the panel is collapsed, expand it when switching
    if (isPanelCollapsed) {
      setIsPanelCollapsed(false);
    }
  };

  // Start a new chat
  const handleNewChat = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/chat/new`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to create a new chat');
      }
      
      const data = await response.json();
      setCurrentChatId(data.id);
      setMessages([]);
      // Intentionally left commented out so the file selection carries over to the new chat
      // setSelectedFiles([]);
      
      // Refresh the history list
      setHistoryRefreshTrigger(prev => prev + 1);
      
    } catch (err) {
      console.error('Error creating a new chat:', err);
      alert('Could not create a new chat. Please try again later.');
    }
  };

  // Load a chat from history
  const handleSelectChat = async (chatId: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/chat/history/${chatId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load chat history');
      }
      
      const chatHistory = await response.json();
      
      // Convert chat history into the format this app uses
      const convertedMessages: Message[] = [];
      
      for (const message of chatHistory) {
        // Skip system metadata messages (such as title info)
        if (message.role === 'system' && message.content === 'Chat title metadata') {
          continue;
        }
        
        if (message.role === 'user') {
          convertedMessages.push({
            role: 'user',
            content: message.content,
            timestamp: message.timestamp,
            cycleIEEnabledWhenSent: message.additional_data?.cycleie_enabled || false,
            selectedFiles: message.additional_data?.selected_files || undefined
          });
        } else if (message.role === 'assistant') {
          // Restore the original thought-process data regardless of the current CycleIE state
          const messageThoughtProcess = message.additional_data?.thought_process || [];
          const messageCycleIEEnabled = message.additional_data?.cycleie_enabled || false;
          
          convertedMessages.push({
            role: 'assistant',
            content: message.content,
            timestamp: message.timestamp,
            thinking: false,
            // Restore the full thought process for this historical message
            thoughtProcess: messageThoughtProcess,
            cycleIEEnabledWhenSent: messageCycleIEEnabled
          });
        }
      }
      
      // Update the message list and the current chat ID
      setMessages(convertedMessages);
      setCurrentChatId(chatId);
      
      // If the latest assistant message has a thought process, use it as the current workflow (CycleIE mode only)
      const lastAssistantMessage = convertedMessages
        .filter(msg => msg.role === 'assistant')
        .pop();
      
      if (lastAssistantMessage?.thoughtProcess && lastAssistantMessage.thoughtProcess.length > 0) {
        setCurrentThoughtProcess(lastAssistantMessage.thoughtProcess);
      } else {
        // If there is no thought process, reset to null so the default content is shown
        setCurrentThoughtProcess(null);
      }
      // Clearing currentThoughtProcess is intentionally left commented out so the workflow button stays visible
      // else {
      //   setCurrentThoughtProcess(null);
      // }
      
      // Clear the file selection (optional; keep or drop depending on requirements)
      // setSelectedFiles([]);
      
    } catch (err) {
      console.error('Error selecting chat:', err);
      alert('Could not load the chat history. Please try again later.');
    }
  };

  // Create a new chat when the component mounts
  useEffect(() => {
    handleNewChat();
  }, []);

  const handleQuerySubmit = async (query: string) => {
    if (isProcessing) return;
    
    // Append the new user message instead of resetting the message list
    const newUserMessage: Message = {
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      cycleIEEnabledWhenSent: cycleIEEnabled,  // Store the CycleIE state when the message was sent
      selectedFiles: selectedFiles.length > 0 ? selectedFiles.map(file => ({ 
        filename: file.filename, 
        filepath: file.filepath 
      })) : undefined  // Include selected files with the message
    };
    
    // Append the user message to the existing list
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setIsProcessing(true);

    // Handle the SSE stream with an EventSource-style reader
    let thoughtProcess: string[] = [];
    let temporaryThoughts: string[] = []; // Track temporary thoughts separately
    let lastNonTemporaryTime = Date.now(); // Track when the last non-temporary thought was received
    let finalAnswer = '';
    
    try {
      // Add a "thinking" message 
      setMessages(prevMessages => [
        ...prevMessages, 
        {
          role: 'assistant',
          content: '',
          thinking: cycleIEEnabled,  // Only show thinking state in CycleIE mode
          thoughtProcess: [],
          timestamp: new Date().toISOString(),
          cycleIEEnabledWhenSent: cycleIEEnabled,  // Store the CycleIE state when the message was sent
          isLoading: !cycleIEEnabled,  // Show simple loading in simple mode
          liveThinking: cycleIEEnabled,  // Show thinking live
          showThinkingAsContent: cycleIEEnabled  // Show the thought process as the answer content
        } as Message
      ]);

      // Get file paths from selected files
      const filePaths = selectedFiles.length > 0 
        ? selectedFiles.map(file => file.filepath)
        : [];

      // Important: a file-less query runs only when the user has not selected any files
      // Do not fall back to using every file
      // Build a POST request body
      const postData = {
        query,
        file_paths: filePaths,
        selected_files: selectedFiles.length > 0 ? selectedFiles.map(file => ({
          filename: file.filename,
          filepath: file.filepath
        })) : [],  // Include details of the selected files
        use_all_files: false,  // Do not use every file by default
        stream: true,
        cycleie_enabled: cycleIEEnabled,  // Include the CycleIE state
        chat_id: currentChatId,  // Include the current chat ID
        is_edit: false,  // Marks this as an edit operation
        model: currentModel  // Include the currently selected model
      };
      
      // Create a new AbortController for this request
      const controller = new AbortController();
      setAbortController(controller);
      
      // Open an SSE connection
      // Note: the standard EventSource API does not support POST, so use fetch to open the SSE connection
      const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
        signal: controller.signal // Add the signal to allow aborting
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Read the response as a ReadableStream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      
      while (true) {
        try {
          const { value, done } = await reader.read();
          
          if (done) {
            break;
          }
          
          // Decode the chunk and append it to the buffer
          const chunk = decoder.decode(value, { stream: true });
          
          buffer += chunk;
          
          // Process SSE messages
          // SSE format: event: TYPE\ndata: JSON\n\n
          const messages = buffer.split('\n\n');
          
          // Keep the last message in case it is incomplete
          buffer = messages.pop() || '';
          
          // Process messages with a delay between them
          for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            if (!message.trim()) continue;
            
            // Delay depends on CycleIE mode; simple mode has almost no delay
            if (cycleIEEnabled) {
              await new Promise(resolve => setTimeout(resolve, 600));
            }
            // Simple mode does not delay; process immediately
            
            try {
              // Parse the SSE message
              const eventMatch = message.match(/^event: (.+)$/m);
              const dataMatch = message.match(/^data: (.+)$/m);
              
              if (eventMatch && dataMatch) {
                const eventType = eventMatch[1];
                const data = JSON.parse(dataMatch[1]);
                
                
                // Special handling for "Loading and processing documents..." message (only in CycleIE mode)
                if (eventType === 'thinking' && 
                    data.content === "Loading and processing documents...\n") {
                  // Skip the document-loading message in simple mode
                  if (!cycleIEEnabled) {
                    continue;
                  }
                  
                  
                  // Create a temporary thought with the special [TEMP] marker
                  const tempLoadingThought = "[TEMP] " + data.content;
                  temporaryThoughts = [tempLoadingThought];
                  
                  // Update message display to show the loading thought
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[newMessages.length - 1];
                    if (assistantMsg.role === 'assistant' && assistantMsg.thinking) {
                      assistantMsg.thoughtProcess = [...thoughtProcess, ...temporaryThoughts];
                    }
                    return newMessages;
                  });
                  
                  continue; // Skip the rest of the processing for this message
                }
                
                if (eventType === 'thinking') {
                  // In simple mode, ignore thinking steps entirely; the user does not need deep analysis
                  if (!cycleIEEnabled) {
                    // Simple mode: skip all thinking logic and do not update any state
                    continue; // Skip thinking: do not show the workflow or update the message
                  }
                  
                  // CycleIE mode uses the more involved handling below
                  // Step 1: only thoughts that include the [TEMP] marker are treated as temporary
                  const hasSpecialTempMarker = data.content.includes('[TEMP]');
                  
                  // If we had a "Loading and processing documents..." message,
                  // replace it with a "Documents load and process finished" message
                  if (temporaryThoughts.some(t => t.includes("Loading and processing documents"))) {
                    thoughtProcess.push("[TEMP] Documents load and process finished.");
                    temporaryThoughts = temporaryThoughts.filter(
                      t => !t.includes("Loading and processing documents")
                    );
                  }
                  
                  // Step 2: handle the thought according to whether it has a [TEMP] marker
                  if (hasSpecialTempMarker) {
                    // Replace the existing temporary thought
                    temporaryThoughts = [data.content];
                    lastNonTemporaryTime = Date.now(); // Reset timer for temporary thoughts
                  } else {
                    // This is a regular thought; append it to the thought process
                    thoughtProcess.push(data.content);
                    
                    // Clear temporary thoughts now that a new regular thought has arrived
                    temporaryThoughts = [];
                    lastNonTemporaryTime = Date.now();
                  }
                  
                  // Step 3: update the thought-process display
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[newMessages.length - 1];
                    if (assistantMsg.role === 'assistant' && assistantMsg.thinking) {
                      // Merge regular and temporary thoughts
                      assistantMsg.thoughtProcess = [...thoughtProcess, ...temporaryThoughts];
                      
                      // In Mosaic mode with liveThinking, build the full answer in real time
                      if (assistantMsg.liveThinking && assistantMsg.showThinkingAsContent) {
                        let completeAnswer = '';
                        
                        // Add the thought-process text
                        [...thoughtProcess, ...temporaryThoughts].forEach(thought => {
                                                  // Strip markers and keep only the plain text
                        const cleanedThought = thought
                          .replace('[TEMP]', '')
                          .replace('[THINKING]', '')
                          .replace('[SEARCH]', '')
                          .replace('[EXTRACT]', '')
                          .replace('[VERIFY]', '')
                          .replace('[REASON]', '')
                          .replace('[DECISION]', '')
                          .replace('[REFINE]', '')
                          .trim();
                          
                          if (cleanedThought) {
                            completeAnswer += cleanedThought + '\n\n';
                          }
                        });
                        
                        // In Mosaic mode the thought process is the answer; update content live
                        assistantMsg.content = completeAnswer;
                      }
                    }
                    return newMessages;
                  });
                  
                  // Show the workflow automatically when there is a thought process
                  if ((thoughtProcess.length > 0 || temporaryThoughts.length > 0) && cycleIEEnabled) {
                    const currentThoughts = [...thoughtProcess, ...temporaryThoughts];
                    setCurrentThoughtProcess(currentThoughts);
                    setRightPanelType('workflow');
                    setIsRightPanelCollapsed(false);
                  }
                } else if (eventType === 'answer') {
                  finalAnswer = data.content;
                  
                  // Handle the answer based on whether live thinking is enabled
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === 'assistant') {
                      if (lastMessage.liveThinking && lastMessage.showThinkingAsContent && cycleIEEnabled) {
                        // In Mosaic mode, if content (the thought process) already exists, only append the final answer
                        if (lastMessage.content && finalAnswer) {
                          // If there is an extra finalAnswer, add a separator and the final answer
                          lastMessage.content += '---\n\n' + finalAnswer;
                        } else if (finalAnswer) {
                          // If there is no thought-process content, set the final answer directly
                          lastMessage.content = finalAnswer;
                        }
                        lastMessage.thinking = false;
                        lastMessage.thoughtProcess = thoughtProcess; // Keep the original thought process
                      } else {
                        // Classic mode: start the typewriter effect
                        lastMessage.fullContent = finalAnswer; // Full text used by the typewriter effect
                        lastMessage.typewriting = true; // Start the typewriter effect
                        lastMessage.thinking = false;
                        lastMessage.thoughtProcess = thoughtProcess; // Keep the thought process
                        
                        // If the typewriter effect is not used, set content directly
                        if (!lastMessage.typewriting) {
                          lastMessage.content = finalAnswer;
                        }
                      }
                      lastMessage.isLoading = false; // Clear the loading state
                    }
                    return newMessages;
                  });
                  
                  // Make sure the final thought process is shown in the workflow (CycleIE mode only)
                  if (thoughtProcess.length > 0 && cycleIEEnabled) {
                    setCurrentThoughtProcess([...thoughtProcess]);
                  }
                }
              }
            } catch (parseError) {
              console.error('Failed to parse SSE message:', parseError, 'Raw message:', message);
            }
          }
        } catch (streamError: any) {
          if (streamError.name === 'AbortError') {
            break;
          } else {
            console.error('Error reading stream:', streamError);
            throw streamError;
          }
        }
      }
      
      // In Mosaic mode, if there is a thought process but no answer event, the thought process is the final answer
      if (!finalAnswer && cycleIEEnabled && thoughtProcess.length > 0) {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant' && lastMessage.thinking && lastMessage.liveThinking) {
            // In Mosaic mode the thought process is the final answer; stop the thinking state
            lastMessage.thinking = false;
            lastMessage.isLoading = false;
            
            // Save the thought process into content if it is not already there
            if (!lastMessage.content || lastMessage.content.trim().length === 0) {
              let completeAnswer = '';
              thoughtProcess.forEach(thought => {
                const cleanedThought = thought
                  .replace('[TEMP]', '')
                  .replace('[THINKING]', '')
                  .replace('[SEARCH]', '')
                  .replace('[EXTRACT]', '')
                  .replace('[VERIFY]', '')
                  .replace('[REASON]', '')
                  .replace('[DECISION]', '')
                  .replace('[REFINE]', '')
                  .trim();
                
                if (cleanedThought) {
                  completeAnswer += cleanedThought + '\n\n';
                }
              });
              lastMessage.content = completeAnswer;
            } else {
            }
          }
          return newMessages;
        });
      } else if (!finalAnswer) {
        // Handle the non-Mosaic case, or when there is no thought process
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant' && (lastMessage.thinking || lastMessage.isLoading)) {
            lastMessage.thinking = false;
            lastMessage.isLoading = false;
            
            // Make sure content is not empty
            if (!lastMessage.content) {
              lastMessage.content = lastMessage.fullContent || 'Processing finished, but no final answer was received.';
            }
          }
          return newMessages;
        });
      }
      
    } catch (error: any) {
      console.error('Error processing query:', error);
      
      // Show an error message unless the request was aborted
      if (!error.name || error.name !== 'AbortError') {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            // In Mosaic mode, keep any existing thought-process content and append the error
            if (lastMessage.liveThinking && lastMessage.showThinkingAsContent && lastMessage.content) {
              lastMessage.content += '\n\n---\n\n' + `An error occurred while processing the query: ${error.message || error}`;
            } else {
              lastMessage.content = `An error occurred while processing the query: ${error.message || error}`;
            }
            lastMessage.thinking = false;
            lastMessage.isLoading = false;
          }
          return newMessages;
        });
      }
    } finally {
      setIsProcessing(false);
      setAbortController(null);
      
      // Refresh the chat history list after the answer is generated
      setHistoryRefreshTrigger(prev => prev + 1);
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
    // Also clear the file selection so the next conversation starts clean
    setSelectedFiles([]);
  };

  // Function to handle file overwrite confirmation
  const confirmFileOverwrite = async () => {
    // Close the dialog
    setOverwriteConfirmOpen(false);
    
    if (!fileToOverwrite || !fileOverwritePath) {
      return;
    }
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(fileToOverwrite);
      
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1]; // Remove data URL prefix
        
        // Call the API to overwrite the file
        const response = await axios.post(overwriteUrl, {
          filepath: fileOverwritePath,
          file_data: base64Data
        });
        
        // Add the overwritten file to the list
        setUploadedFiles(prev => [...prev, {
          filename: response.data.filename,
          filepath: response.data.filepath,
          size: fileToOverwrite.size
        }]);
        
        // Add a system message about the overwrite
        setMessages(prev => [...prev, {
          role: 'system',
          content: `File "${fileToOverwrite.name}" has been overwritten.`,
          timestamp: new Date().toISOString()
        }]);
        
        // Reset the file to overwrite
        setFileToOverwrite(null);
        setFileOverwritePath('');
        
        // Reload the Faiss index to update with the overwritten file
        setIsReloadingIndex(true);
        try {
          await axios.post(indexUrl);
          // We don't need an additional message since we already showed the overwrite success message
        } catch (error) {
          console.error('Error reloading index after file overwrite:', error);
          // Show warning message
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Warning: Faiss index may be out of sync after file overwrite.',
            timestamp: new Date().toISOString()
          }]);
        } finally {
          setIsReloadingIndex(false);
        }
      };
    } catch (error) {
      console.error('Error overwriting file:', error);
      const errorMessage = axios.isAxiosError(error) 
        ? error.response?.data?.error || error.message
        : String(error);
        
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error overwriting file: ${errorMessage}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };
  
  const cancelFileOverwrite = () => {
    // Close the dialog and reset the file to overwrite
    setOverwriteConfirmOpen(false);
    setFileToOverwrite(null);
    setFileOverwritePath('');
    
    setMessages(prev => [...prev, {
      role: 'system',
      content: `File upload cancelled.`,
      timestamp: new Date().toISOString()
    }]);
  };

  // Function to reload the Faiss index
  const handleReloadIndex = async () => {
    setIsReloadingIndex(true);
    try {
      const response = await axios.post(indexUrl);
      // Show success message
      setMessages(prevMessages => [
        ...prevMessages,
        {
          role: 'system',
          content: response.data.message || 'Faiss index reloaded successfully.',
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error reloading index:', error);
      // Show error message
      setMessages(prevMessages => [
        ...prevMessages,
        {
          role: 'system',
          content: 'Error reloading Faiss index. Please try again.',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsReloadingIndex(false);
    }
  };

  // Handle editing a message
  const handleEditMessage = async (messageIndex: number, newContent: string) => {
    if (!currentChatId) {
      console.error('No current chat ID for editing message');
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/chat/edit/${currentChatId}/${messageIndex}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: newContent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      const result = await response.json();
      
      if (result.success) {
        // Update the local message list: truncate at the edited message, then append the edited message
        setMessages(prevMessages => {
          const newMessages = [...prevMessages];
          // Truncate to before the edited message
          const truncatedMessages = newMessages.slice(0, messageIndex);
          // Append the edited user message
          truncatedMessages.push({
            role: 'user',
            content: newContent,
            timestamp: new Date().toISOString(),
            cycleIEEnabledWhenSent: cycleIEEnabled,
            selectedFiles: selectedFiles.length > 0 ? selectedFiles.map(file => ({ 
              filename: file.filename, 
              filepath: file.filepath 
            })) : undefined  // Include selected files with the edited message
          } as Message);
          return truncatedMessages;
        });

        // Process the query directly instead of via handleQuerySubmit (avoids adding the user message twice)
        setIsProcessing(true);

        // Handle the SSE stream with an EventSource-style reader
        let thoughtProcess: string[] = [];
        let temporaryThoughts: string[] = []; // Track temporary thoughts separately
        let lastNonTemporaryTime = Date.now(); // Track when the last non-temporary thought was received
        let finalAnswer = '';
        
        try {
          // Add a "thinking" message
          setMessages(prevMessages => [
            ...prevMessages, 
            {
              role: 'assistant',
              content: '',
              thinking: true,
              thoughtProcess: [],
              timestamp: new Date().toISOString(),
              cycleIEEnabledWhenSent: cycleIEEnabled  // Store the CycleIE state when the message was sent
            } as Message
          ]);

          // Get file paths from selected files
          const filePaths = selectedFiles.length > 0 
            ? selectedFiles.map(file => file.filepath)
            : [];

          // Build the query payload
          const postData = {
            query: newContent,
            file_paths: filePaths,
            selected_files: selectedFiles.length > 0 ? selectedFiles.map(file => ({
              filename: file.filename,
              filepath: file.filepath
            })) : [],  // Include details of the selected files
            use_all_files: false,
            stream: true,
            cycleie_enabled: cycleIEEnabled,
            chat_id: currentChatId,
            is_edit: true,  // Marks this as an edit operation
            model: currentModel  // Include the currently selected model
          };
          
          // Create a new AbortController for this request
          const controller = new AbortController();
          setAbortController(controller);
          
          // Open an SSE connection
          const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData),
            signal: controller.signal
          });
          
          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }
          
          if (!response.body) {
            throw new Error('Response body is null');
          }
          
          // Read the response as a ReadableStream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          
          
          while (true) {
            try {
              const { value, done } = await reader.read();
              
              if (done) {
                break;
              }
              
              // Decode the chunk and append it to the buffer
              const chunk = decoder.decode(value, { stream: true });
              
              buffer += chunk;
              
              // Process SSE messages
              const messages = buffer.split('\n\n');
              
              // Keep the last message in case it is incomplete
              buffer = messages.pop() || '';
              
              // Process messages with a delay between them
              for (let i = 0; i < messages.length; i++) {
                const message = messages[i];
                if (!message.trim()) continue;
                
                // Delay depends on CycleIE mode
                if (cycleIEEnabled) {
                  await new Promise(resolve => setTimeout(resolve, 600));
                }
                
                try {
                  // Parse the SSE message
                  const eventMatch = message.match(/^event: (.+)$/m);
                  const dataMatch = message.match(/^data: (.+)$/m);
                  
                  if (eventMatch && dataMatch) {
                    const eventType = eventMatch[1];
                    const data = JSON.parse(dataMatch[1]);
                    
                    
                    if (eventType === 'thinking') {
                      // In simple mode, show thinking steps directly
                      if (!cycleIEEnabled) {
                        thoughtProcess.push(data.content);
                        
                        setMessages(prev => {
                          const newMessages = [...prev];
                          const assistantMsg = newMessages[newMessages.length - 1];
                          if (assistantMsg.role === 'assistant' && assistantMsg.thinking) {
                            assistantMsg.thoughtProcess = [...thoughtProcess];
                          }
                          return newMessages;
                        });
                        
                        continue;
                      }
                      
                      // CycleIE mode uses more involved handling
                      const hasSpecialTempMarker = data.content.includes('[TEMP]');
                      
                      if (hasSpecialTempMarker) {
                        temporaryThoughts = [data.content];
                        lastNonTemporaryTime = Date.now();
                      } else {
                        thoughtProcess.push(data.content);
                        temporaryThoughts = [];
                        lastNonTemporaryTime = Date.now();
                      }
                      
                      setMessages(prev => {
                        const newMessages = [...prev];
                        const assistantMsg = newMessages[newMessages.length - 1];
                        if (assistantMsg.role === 'assistant' && assistantMsg.thinking) {
                          assistantMsg.thoughtProcess = [...thoughtProcess, ...temporaryThoughts];
                        }
                        return newMessages;
                      });
                    } else if (eventType === 'answer') {
                      finalAnswer = data.content;
                      
                      // Replies to edited messages also use the typewriter effect
                      setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage.role === 'assistant') {
                          lastMessage.content = ''; // Clear the current content
                          lastMessage.fullContent = finalAnswer; // Full text used by the typewriter effect
                          lastMessage.typewriting = true; // Start the typewriter effect
                          lastMessage.thinking = false;
                          lastMessage.thoughtProcess = thoughtProcess;
                        }
                        return newMessages;
                      });
                    }
                  }
                } catch (parseError) {
                  console.error('Failed to parse edited-query SSE message:', parseError, 'Raw message:', message);
                }
              }
            } catch (streamError: any) {
              if (streamError.name === 'AbortError') {
                break;
              } else {
                console.error('Error reading edited-query stream:', streamError);
                throw streamError;
              }
            }
          }
          
          // If thinking finished without a final answer, clear the thinking state
          if (!finalAnswer) {
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant' && lastMessage.thinking) {
                lastMessage.thinking = false;
                lastMessage.content = lastMessage.content || 'Processing finished, but no final answer was received.';
              }
              return newMessages;
            });
          }
          
        } catch (error: any) {
          console.error('Error processing edited query:', error);
          
          if (!error.name || error.name !== 'AbortError') {
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant') {
                lastMessage.content = `An error occurred while processing the edited query: ${error.message || error}`;
                lastMessage.thinking = false;
              }
              return newMessages;
            });
          }
        } finally {
          setIsProcessing(false);
          setAbortController(null);
        }
        
      } else {
        throw new Error(result.message || 'Failed to edit message');
      }
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Could not edit the message. Please try again later.');
    }
  };

  // Shared handler for drag-and-drop file uploads
  const handleFiles = (fileList: FileList) => {
    const fileArray = Array.from(fileList);
    // Keep only supported file formats
    const validFiles = fileArray.filter(isValidFile);
    if (validFiles.length > 0) {
      handleFilesUpload(validFiles);
    }
    if (validFiles.length !== fileArray.length) {
      console.warn(`Skipped ${fileArray.length - validFiles.length} unsupported files`);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragActive(false);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const allFiles: File[] = [];
      
      // Process dropped items
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        const entry = item.webkitGetAsEntry?.();
        
        if (entry) {
          if (entry.isFile) {
            // Handle a single file
            const file = item.getAsFile();
            if (file && isValidFile(file)) {
              allFiles.push(file);
            }
          } else if (entry.isDirectory) {
            // Handle a folder
            try {
              const folderFiles = await processDirectoryEntry(entry);
              allFiles.push(...folderFiles);
            } catch (error) {
              console.error('Error processing folder:', error);
            }
          }
        }
      }
      
      if (allFiles.length > 0) {
        handleFilesUpload(allFiles);
      }
      
      e.dataTransfer.clearData();
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Fallback: use the file list directly
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Simplified drag-leave handling
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    //  // Commented out because it produces too many logs
  };

  // Callback when the typewriter effect finishes
  const handleTypewritingComplete = (messageIndex: number) => {
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages[messageIndex] && newMessages[messageIndex].role === 'assistant') {
        newMessages[messageIndex].typewriting = false;
        // Copy fullContent into content, with a type check
        const fullContent = newMessages[messageIndex].fullContent;
        if (fullContent) {
          newMessages[messageIndex].content = fullContent;
        }
      }
      return newMessages;
    });
  };

  // Function to fetch current model from backend
  const fetchCurrentModel = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/settings');
      if (response.data && response.data.model) {
        const modelFromBackend = response.data.model;
        const normalizedModel = normalizeModelValue(modelFromBackend);
        
        if (normalizedModel !== modelFromBackend) {
          console.warn('Backend returned unknown model:', modelFromBackend, 'Using normalized:', normalizedModel);
        } else {
        }
        
        setCurrentModel(normalizedModel);
        
        // Also update the other settings
        setApiKey(response.data.api_key || '');
        setApiUrl(response.data.api_url || '');
      } else {
        // If the backend did not return a valid model, use the default
        setCurrentModel('gpt-4o');
      }
    } catch (error) {
      console.error('Error fetching current model:', error);
      // If the request fails, use the default
      setCurrentModel('gpt-4o');
    }
  };

  // Function to fetch settings when opening modal
  const fetchSettings = async (selectedModel?: string) => {
    try {
      const url = selectedModel 
        ? `http://127.0.0.1:5000/api/settings?model=${selectedModel}` 
        : 'http://127.0.0.1:5000/api/settings';

      const response = await axios.get(url);
      if (response.data) {
        if (response.data.model && !selectedModel) {
          setCurrentModel(response.data.model);
        }
        setApiKey(response.data.api_key || '');
        setApiUrl(response.data.api_url || '');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  // Handle model change
  const handleModelChange = async (newModel: string) => {
    // If "Settings" is selected, open the settings dialog
    if (newModel === 'settings') {
      await fetchSettings();
      setIsSettingsModalOpen(true);
      return;
    }
    
    // Validate and normalize the new model
    const normalizedModel = normalizeModelValue(newModel);
    if (normalizedModel !== newModel) {
      console.warn('Invalid model selected:', newModel, 'Using normalized:', normalizedModel);
    }
    
    const previousModel = currentModel;
    setCurrentModel(normalizedModel);
    
    try {
      const response = await axios.post('http://127.0.0.1:5000/api/settings', {
        model: normalizedModel
      });
      
      if (response.data) {
      }
    } catch (error) {
      console.error('Error updating model:', error);
      // Revert model selection if update fails
      setCurrentModel(previousModel);
      
      // Optionally show an error message to the user
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Failed to switch model: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // Handle settings save
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      const response = await axios.post('http://127.0.0.1:5000/api/settings', {
        model: currentModel,
        api_key: apiKey,
        api_url: apiUrl
      });

      if (response.data) {
        setSaveMessage('Settings saved');
        setTimeout(() => {
          setSaveMessage('');
          setIsSettingsModalOpen(false);
        }, 500);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage(`Failed to save: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', overflow: 'hidden' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {/* Left Sidebar - File Management */}
        <Box sx={{ 
          width: isPanelCollapsed ? '60px' : '360px',
          transition: 'width 0.3s ease-in-out',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isPanelCollapsed ? 'none' : '2px 0 8px rgba(0,0,0,0.1)',
          zIndex: 10
        }}>
          {isPanelCollapsed ? (
            // Collapsed: show the New chat button and the two toggle buttons
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              pt: 2,
              gap: 1
            }}>
              <Tooltip title="New chat" placement="right">
                <IconButton 
                  onClick={handleNewChat}
                  sx={{ 
                    bgcolor: '#000000',
                    color: '#ffffff',
                    height: '30px',
                    width: '30px',
                    '&:hover': { 
                      bgcolor: '#1a1a1a'
                    }
                  }}
                >
                  <AddIcon sx={{ fontSize: '15px' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Document library" placement="right">
                <IconButton 
                  onClick={() => handleLeftPanelTypeChange('files')}
                  sx={{ 
                    bgcolor: 'grey.300',
                    color: 'grey.600',
                    height: '30px',
                    width: '30px',
                    '&:hover': { 
                      bgcolor: 'grey.400'
                    }
                  }}
                >
                  <DnsIcon sx={{ fontSize: '15px' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Chat history" placement="right">
                <IconButton 
                  onClick={() => handleLeftPanelTypeChange('history')}
                  sx={{ 
                    bgcolor: 'grey.300',
                    color: 'grey.600',
                    height: '30px',
                    width: '30px',
                    '&:hover': { 
                      bgcolor: 'grey.400'
                    }
                  }}
                >
                  <HistoryIcon sx={{ fontSize: '15px' }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            // Expanded: show the full panel
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              height: '100%',
              p: 2
            }}>
              {/* Panel header and toggle buttons */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2
              }}>
                {/* Left: toggle button group */}
                <ToggleButtonGroup
                  value={leftPanelType}
                  exclusive
                  onChange={(event, newType) => {
                    if (newType !== null) {
                      setLeftPanelType(newType);
                    }
                  }}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      px: 1.5,
                      py: 0.5,
                      fontSize: '0.75rem',
                      minWidth: 'auto',
                      border: '1px solid #e2e8f0',
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="files">
                    <DnsIcon sx={{ fontSize: '14px', mr: 0.5 }} />
                    Document library
                  </ToggleButton>
                  <ToggleButton value="history">
                    <HistoryIcon sx={{ fontSize: '14px', mr: 0.5 }} />
                    Chat history
                  </ToggleButton>
                </ToggleButtonGroup>
                
                {/* Right: collapse button */}
                <Tooltip title="" placement="bottom">
                  <IconButton 
                    onClick={handlePanelToggle}
                    size="small"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { 
                        bgcolor: 'action.hover' 
                      }
                    }}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              
              {/* Panel content */}
              <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {leftPanelType === 'files' ? (
                  <FileLibraryWithUpload
                    files={uploadedFiles}
                    selectable={true}
                    onFileSelect={toggleFileSelection}
                    selectedFiles={selectedFiles.map(f => f.filepath)}
                    onFileUpload={handleFilesUpload}
                    onDeleteFile={handleFileDelete}
                    onRefreshFiles={handleReloadIndex}
                    onSelectAll={handleSelectAll}
                    onFileRead={handleFileRead}
                    onNewChat={handleNewChat}
                    isUploading={isProcessing}
                    isRefreshing={isReloadingIndex}
                    onPublicFileImport={fetchUploadedFiles}
                    projectId={projectId}
                  />
                ) : (
                  <ChatHistoryPanel
                    onSelectChat={handleSelectChat}
                    onNewChat={handleNewChat}
                    currentChatId={currentChatId}
                    refreshTrigger={historyRefreshTrigger}
                    projectId={projectId}
                  />
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* Main Content Area - Chat Interface */}
        <Box sx={{ 
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative' // relative so the overlay can be positioned
        }}>
          {/* Shared drag-and-drop overlay */}
          {dragActive && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: alpha('#2563eb', 0.1),
                borderRadius: 2,
                border: '2px dashed #2563eb',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(2px)',
                pointerEvents: 'none',
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 80, color: '#2563eb', mb: 2 }} />
              <Typography variant="h5" sx={{ color: '#2563eb', fontWeight: 600 }}>
                Drop files or folders to upload
              </Typography>
              <Typography variant="body1" sx={{ color: '#2563eb', mt: 1 }}>
                Supports PDF, TXT, MD, CSV, DOCX, and similar formats. Folders are processed recursively.
              </Typography>
            </Box>
          )}
          
          {/* Model Selection Header */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1,
            py: 2,
            backgroundColor: '#ffffff',
            zIndex: 5
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {/* Keep the home button and project name close together */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {/* Home Button */}
                {onGoHome && (
                  <Tooltip title="Back to home" placement="bottom">
                    <IconButton
                      onClick={onGoHome}
                      sx={{
                        borderRadius: '50%',
                        color: '#64748b',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          color: '#2563eb',
                          bgcolor: alpha('#2563eb', 0.1),
                          transform: 'scale(1.05)',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)'
                        },
                        '&:active': {
                          transform: 'scale(0.95)',
                          transition: 'transform 0.1s ease-in-out'
                        }
                      }}
                    >
                      <HomeIcon />
                    </IconButton>
                  </Tooltip>
                )}

                {/* Project Name Display */}
                {projectName && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#555555',
                      ml: 0
                    }}
                    title={projectName} // Show the full name on hover
                  >
                  <Box component="span" sx={{ color: '#aaaaaa', mr: 0.5 }}>{'>'}</Box>
                  {projectName.length > 15 ? `${projectName.substring(0, 15)}...` : projectName}
                  </Typography>
                )}
              </Box>

              {/* Extra space between model selection and the previous controls */}
              <FormControl size="small" sx={{ minWidth: 140, ml: 2 }}>
                <Select
                  value={normalizeModelValue(currentModel)}
                  onChange={(e) => handleModelChange(e.target.value)}
                  sx={{
                    height: '32px',
                    fontSize: '0.75rem',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e2e8f0',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#cbd5e1',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2563eb',
                    },
                  }}
                >
                  {MODEL_OPTIONS.map((model) => (
                    <MenuItem key={model.value} value={model.value} sx={{ fontSize: '0.75rem' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {model.value === 'settings' ? (
                          <>
                            <SettingsIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {model.label}
                            </Typography>
                          </>
                        ) : (
                          <>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {model.label}
                            </Typography>
                            <Chip
                              label={model.category.toUpperCase()}
                              size="small"
                              sx={{
                                height: '16px',
                                fontSize: '0.625rem',
                                backgroundColor: 
                                  model.category === 'gpt' ? '#dbeafe' :
                                  model.category === 'deepseek' ? '#dcfce7' :
                                  model.category === 'claude' ? '#fef3c7' :
                                  model.category === 'qianwen' ? '#f3e8ff' : '#f1f5f9',
                                color:
                                  model.category === 'gpt' ? '#1d4ed8' :
                                  model.category === 'deepseek' ? '#166534' :
                                  model.category === 'claude' ? '#92400e' :
                                  model.category === 'qianwen' ? '#7c3aed' : '#475569',
                              }}
                            />
                          </>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

            </Box>
          </Box>
          
          <Container maxWidth="xl" sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            py: 2, 
            px: 3,
            overflow: 'hidden'
          }}>
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              // Keep child layout stable to avoid height jumps
              '& > *:first-of-type': {
                flex: '1 1 0',  // Message area fills the remaining space
                minHeight: 0   // Allow shrinking
              },
              '& > *:last-of-type': {
                flex: '0 0 auto'  // Input area keeps a fixed size
              }
            }}>
              {/* Chat Messages Area */}
              <Paper elevation={1} sx={{ 
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                overflow: 'hidden',
                mb: 3,
                border: 'none', // Remove the border
                boxShadow: 'none', // Remove the shadow
                // Stabilize the layout so changes below do not cause jumps
                position: 'relative'
              }}>
                <Box sx={{ 
                  flexGrow: 1, 
                  overflowY: 'auto', 
                  p: 3,
                  position: 'relative',
                  height: 0 // Force the flex child to respect the parent's height
                }}
                className="chat-messages-container"
                >
                  <ChatMessages 
                    messages={messages} 
                    cycleIEEnabled={cycleIEEnabled} 
                    onFileUpload={undefined} 
                    onEditMessage={handleEditMessage}
                    currentChatId={currentChatId}
                    disableDrag={true}
                    onTypewritingComplete={handleTypewritingComplete}
                    onThinkingProgressClick={handleThinkingProgressClick}
                    onFileRead={handleFileRead}
                  />
                  <div ref={messagesEndRef} />
                </Box>
              </Paper>
              
              {/* Chat Input */}
              <Paper elevation={1} sx={{ 
                borderRadius: 2,
                position: 'relative',
                // Give the ChatInput area a stable layout base
                '& > *': {
                  transition: 'height 0.2s ease-in-out'
                }
              }}>
                <ChatInput 
                  onSubmit={handleQuerySubmit} 
                  isProcessing={isProcessing} 
                  onPause={handlePauseGeneration}
                  uploadedFiles={selectedFiles}
                  onFileRemove={handleFileRemove}
                  cycleIEEnabled={cycleIEEnabled}
                  onCycleIEToggle={handleCycleIEToggle}
                  disableDrag={true}
                />
              </Paper>
            </Box>
          </Container>
        </Box>

        {/* Right Sidebar - Dynamic Panel with Toggle */}
        <Box sx={{ 
          width: isRightPanelCollapsed ? '60px' : `${rightPanelWidth}px`,
          transition: isResizing ? 'none' : 'width 0.3s ease-in-out',
          backgroundColor: '#f8fafc',
          borderLeft: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'row',
          boxShadow: isRightPanelCollapsed ? 'none' : '-2px 0 8px rgba(0,0,0,0.1)',
          zIndex: 10,
          position: 'relative'
        }}>
          {/* Drag-to-resize handle */}
          {!isRightPanelCollapsed && (
            <Box
              onMouseDown={handleMouseDown}
              sx={{
                width: '4px',
                cursor: 'col-resize',
                backgroundColor: 'transparent',
                '&:hover': {
                  backgroundColor: 'primary.main',
                },
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 11
              }}
            />
          )}
          
          {/* Panel content */}
          <Box sx={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}>
          {isRightPanelCollapsed ? (
            // Collapsed: show two buttons
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              pt: 2,
              gap: 1
            }}>
              <Tooltip title="Document reader" placement="left">
                <IconButton 
                  onClick={() => {
                    setRightPanelType('reader');
                    setIsRightPanelCollapsed(false);
                  }}
                  sx={{ 
                    bgcolor: 'grey.300', // Always unselected while collapsed
                    color: 'grey.600',
                    height: '30px',
                    width: '30px',
                    '&:hover': { 
                      bgcolor: 'grey.400'
                    }
                  }}
                >
                  <DescriptionIcon sx={{ fontSize: '15px' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Thought process" placement="left">
                <IconButton 
                  onClick={() => {
                    setRightPanelType('workflow');
                    setIsRightPanelCollapsed(false);
                  }}
                  sx={{ 
                    bgcolor: 'grey.300', // Always unselected while collapsed
                    color: 'grey.600',
                    height: '30px',
                    width: '30px',
                    '&:hover': { 
                      bgcolor: 'grey.400'
                    }
                  }}
                >
                  <InsightsIcon sx={{ fontSize: '15px' }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            // Expanded: show the full panel
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              height: '100%',
              p: 2
            }}>
              {/* Panel header and toggle buttons */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2,
                pb: 1,
                borderBottom: '1px solid #e2e8f0'
              }}>
                {/* Left: toggle button group */}
                <ToggleButtonGroup
                  value={rightPanelType}
                  exclusive
                  onChange={(event, newType) => {
                    if (newType !== null) {
                      setRightPanelType(newType);
                    }
                  }}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      px: 1.5,
                      py: 0.5,
                      fontSize: '0.75rem',
                      minWidth: 'auto',
                      border: '1px solid #e2e8f0',
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="reader">
                    <DescriptionIcon sx={{ fontSize: '14px', mr: 0.5 }} />
                    Document reader
                  </ToggleButton>
                  <ToggleButton value="workflow">
                    <InsightsIcon sx={{ fontSize: '14px', mr: 0.5 }} />
                    Thought process
                  </ToggleButton>
                </ToggleButtonGroup>
                
                {/* Right: collapse button */}
                <Tooltip title="Collapse" placement="bottom">
                  <IconButton 
                    onClick={handleRightPanelToggle}
                    size="small"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { 
                        bgcolor: 'action.hover' 
                      }
                    }}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              
              {/* Panel content */}
              <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {rightPanelType === 'reader' ? (
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {selectedFileForReading ? (
                      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* File title */}
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          mb: 2,
                          pb: 1,
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DescriptionIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '14px' }}>
                              {selectedFileForReading.split('/').pop()}
                            </Typography>
                          </Box>
                          <Tooltip title="Close file" placement="bottom">
                            <IconButton 
                              onClick={() => setSelectedFileForReading(null)}
                              size="small"
                              sx={{ 
                                color: 'text.secondary',
                                '&:hover': { 
                                  bgcolor: 'action.hover' 
                                }
                              }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        
                        {/* File content */}
                        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                                                      <FileContentViewer filepath={selectedFileForReading} projectId={projectId} />
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '200px',
                        color: 'text.secondary'
                      }}>
                        <DescriptionIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                        <Typography variant="body2" align="center">
                          No document selected
                        </Typography>
                        <Typography variant="caption" align="center" sx={{ mt: 1, opacity: 0.7 }}>
                          Click a document in the library to view its contents
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                <Box sx={{ height: '100%' }}>
                  <WorkflowViewer
                    isCollapsed={false}
                    onToggle={() => {}}
                    thoughtProcess={currentThoughtProcess}
                    onClose={handleCloseWorkflow}
                  />
                </Box>
                )}
              </Box>
            </Box>
          )}
          </Box>
        </Box>
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={cancelFileDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">{"Confirm File Deletion"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this file?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelFileDelete}>Cancel</Button>
          <Button onClick={confirmFileDelete} autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Overwrite confirmation dialog */}
      <Dialog
        open={overwriteConfirmOpen}
        onClose={cancelFileOverwrite}
        aria-labelledby="overwrite-dialog-title"
        aria-describedby="overwrite-dialog-description"
      >
        <DialogTitle id="overwrite-dialog-title">{"File Already Exists"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="overwrite-dialog-description">
            {fileToOverwrite ? `"${fileToOverwrite.name}" already exists. Do you want to overwrite it?` : 'File already exists. Do you want to overwrite it?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelFileOverwrite}>Cancel</Button>
          <Button onClick={confirmFileOverwrite} color="warning" autoFocus>
            Overwrite
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Modal */}
      <Dialog
        open={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        aria-labelledby="settings-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="settings-dialog-title">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon />
            Settings
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 2 }}>
            {/* Model Settings Section */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontSize: '1rem', fontWeight: 600 }}>
                Model settings
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>Model</Typography>
                <Select
                  value={normalizeModelValue(currentModel)}
                  onChange={(e) => setCurrentModel(e.target.value)}
                  size="small"
                >
                  {MODEL_OPTIONS.filter(model => model.value !== 'settings').map((model) => (
                    <MenuItem key={model.value} value={model.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {model.label}
                        </Typography>
                        <Chip
                          label={model.category.toUpperCase()}
                          size="small"
                          sx={{
                            height: '16px',
                            fontSize: '0.625rem',
                            backgroundColor: 
                              model.category === 'gpt' ? '#dbeafe' :
                              model.category === 'deepseek' ? '#dcfce7' :
                              model.category === 'claude' ? '#fef3c7' :
                              model.category === 'qianwen' ? '#f3e8ff' : '#f1f5f9',
                            color:
                              model.category === 'gpt' ? '#1d4ed8' :
                              model.category === 'deepseek' ? '#166534' :
                              model.category === 'claude' ? '#92400e' :
                              model.category === 'qianwen' ? '#7c3aed' : '#475569',
                          }}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key"
                size="small"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="API URL"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="Enter API URL"
                size="small"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          {saveMessage && (
            <Typography variant="body2" sx={{ color: 'success.main', mr: 2 }}>
              {saveMessage}
            </Typography>
          )}
          <Button onClick={() => setIsSettingsModalOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveSettings} 
            variant="contained"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};

export default App; 