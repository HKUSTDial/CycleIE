import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import EditIcon from '@mui/icons-material/Edit';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import ThinkingProgress from './ThinkingProgress';
import LiveThinkingRenderer from './LiveThinkingRenderer';
import StructuredContentRenderer from './StructuredContentRenderer';
import { verify } from 'crypto';

// Enhanced typewriter component with full Markdown rendering
interface TypewriterProps {
  text: string;
  speed?: number; // Typing speed (ms)
  punctuationDelay?: number; // Punctuation delay (ms)
  onComplete?: () => void;
}

const Typewriter: React.FC<TypewriterProps> = ({ 
  text, 
  speed = 30, 
  punctuationDelay = 150, 
  onComplete 
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // More precise Markdown syntax handling
  const processMarkdownText = React.useMemo(() => {
    // Count visible characters and handle Markdown syntax more accurately
    const patterns = [
      /#+\s/g,                    // Headings
      /\*\*(.*?)\*\*/g,          // Bold
      /\*(.*?)\*/g,              // Italic
      /~~(.*?)~~/g,              // Strikethrough
      /`([^`]+)`/g,              // Inline code
      /```[\s\S]*?```/g,         // Code blocks
      /\[([^\]]+)\]\([^)]+\)/g,  // Links
      />\s*/gm,                  // Blockquotes
      /^[-*+]\s/gm,              // Unordered lists
      /^\d+\.\s/gm,              // Ordered lists
      /^-\s\[[ x]\]\s/gm,        // Task lists
      /\|.*?\|/g,                // Tables
      /^---+$/gm,                // Horizontal rules
    ];

    let plainText = text;
    patterns.forEach(pattern => {
      plainText = plainText.replace(pattern, (match, group1) => {
        // Keep the content and strip syntax markers
        return group1 || match.replace(/[#*`>|\-\[\]()]/g, '').trim();
      });
    });

    return {
      plainText: plainText.replace(/\s+/g, ' ').trim(),
      totalChars: plainText.replace(/\s+/g, ' ').trim().length
    };
  }, [text]);

  useEffect(() => {
    if (currentIndex < processMarkdownText.totalChars) {
      const currentChar = processMarkdownText.plainText[currentIndex] || '';
      
      // Smarter punctuation detection
      const isPunctuation = /[。！？，；：""''（）【】,.!?;:()[\]"'\-]/.test(currentChar);
      const isEndOfSentence = /[。！？.!?]/.test(currentChar);
      
      let delay = speed;
      if (isEndOfSentence) {
        delay = punctuationDelay * 2; // Longer pause at the end of a sentence
      } else if (isPunctuation) {
        delay = punctuationDelay;
      }
      
      timeoutRef.current = setTimeout(() => {
        // More precise text slicing
        let charCount = 0;
        let displayLength = 0;
        let inCodeBlock = false;
        let inInlineCode = false;
        
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChars = text.slice(i, i + 3);
          
          // Detect code blocks
          if (nextChars === '```') {
            inCodeBlock = !inCodeBlock;
            displayLength = i + 3;
            i += 2; // Skip the next two characters
            continue;
          }
          
          // Detect inline code
          if (char === '`' && !inCodeBlock) {
            inInlineCode = !inInlineCode;
            displayLength = i + 1;
            continue;
          }
          
          // Inside a code block or inline code, include characters as-is
          if (inCodeBlock || inInlineCode) {
            displayLength = i + 1;
            continue;
          }
          
          // Skip Markdown syntax markers
          if (text.slice(i).match(/^#+\s/) || 
              text.slice(i).match(/^\*\*/) || 
              text.slice(i).match(/^~~/) ||
              text.slice(i).match(/^\[.*?\]\(.*?\)/) ||
              text.slice(i).match(/^>\s/) ||
              text.slice(i).match(/^[-*+]\s/) ||
              text.slice(i).match(/^\d+\.\s/) ||
              text.slice(i).match(/^-\s\[[ x]\]\s/)) {
            
            // Find the end of the syntax marker
            let skipLength = 1;
            const headingMatch = text.slice(i).match(/^#+\s/);
            if (headingMatch) {
              skipLength = headingMatch[0].length;
            } else if (text.slice(i).match(/^\*\*/)) {
              const match = text.slice(i).match(/^\*\*(.*?)\*\*/);
              skipLength = match ? match[0].length : 2;
            }
            // ... other syntax handling
            
            displayLength = i + skipLength;
            i += skipLength - 1;
            continue;
          }
          
          // Count visible characters
          if (charCount >= currentIndex + 1) {
            displayLength = i;
              break;
            }
          
            charCount++;
          displayLength = i + 1;
        }
        
        setDisplayedText(text.slice(0, displayLength));
        setCurrentIndex(prev => prev + 1);
      }, delay);
    } else if (currentIndex === processMarkdownText.totalChars && onComplete) {
      onComplete();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentIndex, text, speed, punctuationDelay, onComplete, processMarkdownText]);

  // Reset state when the text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <Box 
      sx={{ 
        position: 'relative', 
        width: '100%',
        '& .markdown-content': {
          '& > *:last-child': {
            display: 'inline-block',
            position: 'relative',
            '&::after': currentIndex < processMarkdownText.totalChars ? {
              content: '"▋"',
              color: '#2563eb',
              animation: 'blink 1s infinite',
              fontSize: '1.1em',
              fontWeight: 'bold',
              marginLeft: '2px',
              '@keyframes blink': {
                '0%, 50%': { opacity: 1 },
                '51%, 100%': { opacity: 0 }
              }
            } : {}
          }
        }
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        className="markdown-content typewriter-content"
        components={{
          // Simplified components for better typewriter performance
          h1: ({children}) => (
            <Typography variant="h4" component="h1" sx={{ 
              fontWeight: 'bold', 
              mb: 2, 
              mt: 2
            }}>
              {children}
            </Typography>
          ),
          h2: ({children}) => (
            <Typography variant="h5" component="h2" sx={{ 
              fontWeight: 'bold', 
              mb: 1.5, 
              mt: 1.5
            }}>
              {children}
            </Typography>
          ),
          h3: ({children}) => (
            <Typography variant="h6" component="h3" sx={{ 
              fontWeight: 'bold', 
              mb: 1, 
              mt: 1
            }}>
              {children}
            </Typography>
          ),
          p: ({children}) => (
            <Typography 
              variant="body1" 
              sx={{ 
                mb: 1, 
                lineHeight: 1.6
              }}
            >
              {children}
            </Typography>
          ),
          strong: ({children}) => (
            <Box component="strong" sx={{ fontWeight: 'bold' }}>
              {children}
            </Box>
          ),
          em: ({children}) => (
            <Box component="em" sx={{ fontStyle: 'italic' }}>
              {children}
            </Box>
          ),
          code: ({children, className}) => {
            const isInline = !className?.includes('language-');
            return isInline ? (
              <Box
                component="code"
                sx={{ 
                  backgroundColor: '#f8f9fa',
                  color: '#e83e8c',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  fontSize: '0.9em',
                  border: '1px solid #e9ecef',
                }}
              >
                {children}
              </Box>
            ) : (
              <Box
                component="pre"
                sx={{
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: 2,
                  borderRadius: 1,
                  overflow: 'auto',
                  mb: 2,
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  fontSize: '0.9em',
                }}
              >
                <code>{children}</code>
              </Box>
            );
          },
        }}
      >
        {displayedText}
      </ReactMarkdown>
    </Box>
  );
};

// Define TypeScript interfaces
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: boolean;
  thoughtProcess?: string[];
  timestamp: string;
  temporary?: boolean;
  cycleIEEnabledWhenSent?: boolean;
  typewriting?: boolean; // Whether the typewriter effect is running
  fullContent?: string; // Full content used by the typewriter effect
  isLoading?: boolean; // Simple loading state
  liveThinking?: boolean; // Whether to use live thinking display mode
  showThinkingAsContent?: boolean; // Whether to show the thought process as the answer
  selectedFiles?: { filename: string; filepath: string }[]; // Selected files attached to the message
  uploading?: boolean; // Whether this is a file-upload status message
  uploadProgress?: { // Upload progress
    total: number;
    completed: number;
    current?: string; // Filename currently being uploaded
  };
}

interface ChatMessagesProps {
  messages: Message[];
  cycleIEEnabled?: boolean;
  onFileUpload?: (files: File[]) => void;
  onEditMessage?: (index: number, newContent: string) => void;
  currentChatId?: string | null;
  disableDrag?: boolean;
  onTypewritingComplete?: (index: number) => void; // Callback when the typewriter effect finishes
  onThinkingProgressClick?: (messageIndex?: number) => void; // Callback when thinking progress is clicked
  onFileRead?: (filepath: string) => void; // Callback to open a file for reading
}

// Markdown renderer
const MarkdownRenderer: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // Custom component styles
        h1: ({children}) => (
          <Typography variant="h4" component="h1" sx={{ 
            fontWeight: 'bold', 
            mb: 2, 
            mt: 2,
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '8px'
          }}>
            {children}
          </Typography>
        ),
        h2: ({children}) => (
          <Typography variant="h5" component="h2" sx={{ 
            fontWeight: 'bold', 
            mb: 1.5, 
            mt: 1.5,
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '6px'
          }}>
            {children}
          </Typography>
        ),
        h3: ({children}) => (
          <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold', mb: 1, mt: 1 }}>
            {children}
          </Typography>
        ),
        h4: ({children}) => (
          <Typography variant="subtitle1" component="h4" sx={{ fontWeight: 'bold', mb: 0.5, mt: 0.5 }}>
            {children}
          </Typography>
        ),
        h5: ({children}) => (
          <Typography variant="subtitle2" component="h5" sx={{ fontWeight: 'bold', mb: 0.5, mt: 0.5 }}>
            {children}
          </Typography>
        ),
        h6: ({children}) => (
          <Typography variant="body1" component="h6" sx={{ fontWeight: 'bold', mb: 0.5, mt: 0.5 }}>
            {children}
          </Typography>
        ),
        p: ({children}) => (
          <Typography variant="body1" sx={{ mb: 1, lineHeight: 1.6, color: '#0f172a' }}>
            {children}
          </Typography>
        ),
        strong: ({children}) => (
          <Box component="strong" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
            {children}
          </Box>
        ),
        em: ({children}) => (
          <Box component="em" sx={{ fontStyle: 'italic', color: '#4b5563' }}>
            {children}
          </Box>
        ),
        code: ({children, className}) => {
          const isInline = !className?.includes('language-');
          const language = className?.replace('language-', '') || '';
          
          return isInline ? (
            <Box
              component="code"
              sx={{
                backgroundColor: '#f8f9fa',
                color: '#e83e8c',
                padding: '3px 6px',
                borderRadius: '4px',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '0.9em',
                border: '1px solid #e9ecef',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
            >
              {children}
            </Box>
          ) : (
            <Box sx={{ mb: 2 }}>
              {language && (
                <Box
                  sx={{
                    backgroundColor: '#f8f9fa',
                    padding: '8px 12px',
                    borderRadius: '6px 6px 0 0',
                    fontSize: '0.8em',
                    color: '#6c757d',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    borderBottom: '1px solid #e9ecef',
                    fontWeight: 500,
                  }}
                >
                  {language.toUpperCase()}
                </Box>
              )}
              <Box
                component="pre"
                sx={{
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: 2,
                  borderRadius: language ? '0 0 6px 6px' : '6px',
                  overflow: 'auto',
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  fontSize: '0.9em',
                  margin: 0,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  '& code': {
                    backgroundColor: 'transparent',
                    padding: 0,
                    border: 'none',
                    color: 'inherit',
                    display: 'block',
                    lineHeight: 1.5,
                  },
                  '&:hover': {
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    transition: 'box-shadow 0.3s ease',
                  }
                }}
              >
                <code>{children}</code>
              </Box>
            </Box>
          );
        },
        blockquote: ({children}) => (
          <Box
            sx={{
              borderLeft: '4px solid #2563eb',
              paddingLeft: 2,
              marginLeft: 0,
              marginY: 2,
              backgroundColor: '#f8fafc',
              padding: 2,
              borderRadius: '0 6px 6px 0',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              position: 'relative',
              '& p:last-child': { mb: 0 },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-5px',
                left: '10px',
                fontSize: '3em',
                color: '#cbd5e1',
                fontFamily: 'Georgia, serif',
              }
            }}
          >
            {children}
          </Box>
        ),
        ol: ({children}) => (
          <Box
            component="ol"
            sx={{
              marginBottom: 2,
              paddingLeft: '20px', // Restore a reasonable padding
              listStyleType: 'decimal',
              listStylePosition: 'outside',
              '& li': {
                marginBottom: 0.5,
                lineHeight: 1.6,
                '&::marker': {
                  color: '#2563eb',
                  fontWeight: 600,
                }
              }
            }}
          >
            {children}
          </Box>
        ),
        ul: ({children}) => (
          <Box
            component="ul"
            sx={{
              marginBottom: 2,
              paddingLeft: '20px', // Restore a reasonable padding
              listStyleType: 'disc',
              listStylePosition: 'outside',
              '& li': {
                marginBottom: 0.5,
                lineHeight: 1.6,
                '&::marker': {
                  color: '#2563eb',
                  fontWeight: 'bold',
                }
              }
            }}
          >
            {children}
          </Box>
        ),
        li: ({children, ...props}) => {
          // Check whether this is a task-list item
          const isTaskList = typeof children === 'object' && 
            Array.isArray(children) && 
            children.some(child => 
              typeof child === 'object' && 
              child?.type === 'input' && 
              child?.props?.type === 'checkbox'
            );

          if (isTaskList) {
            return (
              <Box
                component="li"
                sx={{
                  marginBottom: 0.5,
                  lineHeight: 1.6,
                  listStyleType: 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                {children}
              </Box>
            );
          }

          return (
            <Box
              component="li"
              sx={{
                marginBottom: 0.5,
                lineHeight: 1.6,
                // Let the parent control margin and styling
              }}
            >
              {children}
            </Box>
          );
        },
        // Task-list checkbox
        input: ({type, checked, ...props}) => {
          if (type === 'checkbox') {
            return (
              <input
                type="checkbox"
                checked={checked}
                disabled
                style={{
                  marginRight: '8px',
                  transform: 'scale(1.1)',
                  accentColor: '#2563eb',
                }}
                {...(props as any)}
              />
            );
          }
          return <input type={type} {...(props as any)} />;
        },
        table: ({children}) => (
          <Box
            sx={{
              overflowX: 'auto',
              mb: 2,
              border: '1px solid #e5e7eb',
              borderRadius: 1,
              backgroundColor: '#fff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Box component="table" sx={{ 
              width: '100%', 
              borderCollapse: 'separate',
              borderSpacing: 0,
            }}>
              {children}
            </Box>
          </Box>
        ),
        thead: ({children}) => (
          <Box component="thead" sx={{ 
            backgroundColor: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
          }}>
            {children}
          </Box>
        ),
        th: ({children}) => (
          <Box
            component="th"
            sx={{
              border: '1px solid #e5e7eb',
              padding: '16px',
              fontWeight: 'bold',
              textAlign: 'left',
              fontSize: '0.9em',
              backgroundColor: '#f9fafb',
              color: '#374151',
              borderBottom: '2px solid #e5e7eb',
            }}
          >
            {children}
          </Box>
        ),
        td: ({children}) => (
          <Box
            component="td"
            sx={{
              border: '1px solid #e5e7eb',
              padding: '14px 16px',
              fontSize: '0.9em',
              color: '#4b5563',
              borderBottom: '1px solid #f3f4f6',
              '&:hover': {
                backgroundColor: '#f3f4f6',
                transition: 'background-color 0.2s ease',
              }
            }}
          >
            {children}
          </Box>
        ),
        tr: ({children}) => (
          <Box 
            component="tr" 
            sx={{
              '&:nth-of-type(even) td': {
                backgroundColor: '#f9fafb',
              },
              '&:hover td': {
                backgroundColor: '#f3f4f6',
                transition: 'background-color 0.2s ease',
              }
            }}
          >
            {children}
          </Box>
        ),
        a: ({children, href}) => (
          <Box
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: '#2563eb',
              textDecoration: 'none',
              borderBottom: '1px solid transparent',
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#1d4ed8',
                borderBottomColor: '#2563eb',
              }
            }}
          >
            {children}
          </Box>
        ),
        hr: () => (
          <Box
            sx={{
              border: 'none',
              height: '2px',
              background: 'linear-gradient(to right, transparent, #e5e7eb, transparent)',
              margin: '32px 0',
            }}
          />
        ),
        // Strikethrough
        del: ({children}) => (
          <Box component="del" sx={{ 
            textDecoration: 'line-through', 
            color: '#9ca3af',
            opacity: 0.8 
          }}>
            {children}
          </Box>
        ),
      }}
      className={className}
    >
      {content}
    </ReactMarkdown>
  );
};

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, cycleIEEnabled = true, onFileUpload, onEditMessage, currentChatId, disableDrag, onTypewritingComplete, onThinkingProgressClick, onFileRead }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // File collapse state
  const [fileCollapsedState, setFileCollapsedState] = useState<{ [messageIndex: number]: boolean }>({});

  // Toggle the file list between collapsed and expanded
  const toggleFileCollapse = (messageIndex: number) => {
    setFileCollapsedState(prev => ({
      ...prev,
      [messageIndex]: prev[messageIndex] === false ? true : false
    }));
  };

  // Open a file for reading
  const handleFileClick = (filepath: string) => {
    if (onFileRead) {
      onFileRead(filepath);
    }
  };

  // Edit handlers
  const handleStartEdit = (index: number, content: string) => {
    setEditingIndex(index);
    setEditingContent(content);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingContent('');
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && onEditMessage && editingContent.trim()) {
      onEditMessage(editingIndex, editingContent.trim());
      setEditingIndex(null);
      setEditingContent('');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Hover effects for edit button
  const handleMouseEnter = (index: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredMessageIndex(index);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredMessageIndex(null);
    }, 100); // Reduced delay from 300ms to 100ms
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Cancel edit mode when currentChatId changes
  useEffect(() => {
    if (editingIndex !== null) {
      setEditingIndex(null);
      setEditingContent('');
    }
  }, [currentChatId]);

  // Whether to use Mosaic rendering
  const shouldUseStructuredRenderer = (message: Message) => {
    // Use StructuredContentRenderer only after generation finishes
    if (message.thinking || message.typewriting || message.isLoading) {
      return false;
    }
    
    // Check whether the thought process contains Graph content — stronger detection
    const hasGraphInThoughts = message.thoughtProcess && message.thoughtProcess.some(thought => {
      // Multiple detection methods
      const simpleCheck = thought.includes('[EXTRACT]') && thought.includes('<Graph START>') && thought.includes('<Graph END>');
      const regexCheck = /<Graph\s*START>[\s\S]*?<Graph\s*END>/i.test(thought);
      const tripleCheck = thought.includes('(') && thought.includes(',') && thought.includes(')') && 
                         (thought.includes('Graph') || thought.includes('[EXTRACT]'));
      
      return simpleCheck || regexCheck || tripleCheck;
    });
    
    
    // For history: use Mosaic rendering if the message was sent in Mosaic mode or contains Graph content
    // Do not depend on the current cycleIEEnabled state, so historical messages stay correct
    return message.cycleIEEnabledWhenSent === true || hasGraphInThoughts;
  };

  // Function to render each type of message
  const renderMessage = (message: Message, index: number) => {
    const { role, content, thinking, thoughtProcess, typewriting, fullContent, isLoading, liveThinking, showThinkingAsContent, uploading, uploadProgress } = message;
    
    // Filter out debug messages
    const filterDebugMessages = (content: string): string => {
      if (!content) return '';
      
      let result = content;
      const debugPatterns = [
        /^Starting analysis for query:.*?\n/im,
        /^Loading and processing documents.*?\n/im,
        /^Documents load and process finished.*?\n/im,
        /^I will use the following query for search:.*?\n/im,
        /^Structure selection result:.*?\n/im,
        /^Verification Result:.*?\n/im,
        /^Information verification failed.*?\n/im,
        /^Information verification passed.*?\n/im,
      ];
      
      for (const pattern of debugPatterns) {
        result = result.replace(pattern, '');
      }
      
      return result;
    };
    
    // Filtered content
    const filteredContent = filterDebugMessages(content);
    const filteredFullContent = fullContent ? filterDebugMessages(fullContent) : '';
    
    return (
      <Box key={index} sx={{ mb: 2 }}>
        {role === 'assistant' ? (
          // Assistant reply: left-aligned, no chat bubble
          <Box sx={{ mr: 4 }}>
            {/* Thinking progress */}
            {thinking && (
              <ThinkingProgress 
                thoughtProcess={thoughtProcess || []}
                isThinking={true}
                onClick={() => onThinkingProgressClick?.(index)}
              />
            )}

            {/* Live thinking display */}
            {liveThinking && showThinkingAsContent ? (
              thinking ? (
                <LiveThinkingRenderer
                  thoughtProcess={thoughtProcess || []}
                  isThinking={true}
                  finalContent=""
                  showFinalContent={false}
                  filterConfig={{
                    maxThoughts: undefined, // No count limit; filter by marker type only
                    excludeTypes: ['search', 'extract', 'verify', 'structure'], // Keep thinking and reasoning steps; exclude technical steps
                    coherenceMode: true, // Smooth the text for better flow
                    keywordFilters: undefined // Filter by marker type, not content keywords
                  }}
                />
              ) : (
                // After thinking finishes, show the full answer including the thought process
                <>
                  {/* Show completed thinking progress if there's a thought process */}
                  {thoughtProcess && thoughtProcess.length > 0 && (
                    <ThinkingProgress 
                      thoughtProcess={thoughtProcess}
                      isThinking={false}
                      onClick={() => onThinkingProgressClick?.(index)}
                    />
                  )}
                  {/* Choose renderer based on Mosaic mode */}
                  {shouldUseStructuredRenderer(message) ? (
                    <StructuredContentRenderer content={filteredContent} thoughtProcess={thoughtProcess} />
                  ) : (
                    <MarkdownRenderer content={filteredContent} className="markdown-content" />
                  )}
                </>
              )
            ) : (
              <>
                {thinking ? (
                  <Box>
                    {/* Show thinking progress */}
                    <ThinkingProgress 
                      thoughtProcess={thoughtProcess || []}
                      isThinking={true}
                      onClick={() => onThinkingProgressClick?.(index)}
                    />
                  </Box>
                ) : isLoading ? (
                  // Simple loading state for non-CycleIE mode
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    mb: 2,
                    backgroundColor: 'transparent',
                  }}>
                    <CircularProgress size={20} color="primary" />
                  </Box>
                ) : (
                  <>
                    {/* Show completed thinking progress if there's a thought process */}
                    {thoughtProcess && thoughtProcess.length > 0 && (
                      <ThinkingProgress 
                        thoughtProcess={thoughtProcess}
                        isThinking={false}
                        onClick={() => onThinkingProgressClick?.(index)}
                      />
                    )}
                  </>
                )}
                
                {!thinking && (
                  // Choose renderer based on whether the typewriter effect is active
                  typewriting && fullContent ? (
                    <>
                      <Typewriter 
                        text={filteredFullContent || fullContent}
                        speed={15}
                        punctuationDelay={70}
                        onComplete={() => {
                          // When the typewriter effect finishes, clear the typewriting flag
                          if (onTypewritingComplete) {
                            onTypewritingComplete(index);
                          }
                        }}
                      />
                      {/* Hint while the typewriter runs if the message will use Mosaic mode */}
                      {cycleIEEnabled && message.cycleIEEnabledWhenSent && (
                        <Box className="loading-indicator">
                          Analyzing content structure...
                        </Box>
                      )}
                    </>
                  ) : (
                    // Choose renderer based on Mosaic mode
                    shouldUseStructuredRenderer(message) ? (
                      <StructuredContentRenderer content={filteredContent} thoughtProcess={thoughtProcess} />
                    ) : (
                      <MarkdownRenderer content={filteredContent} className="markdown-content" />
                    )
                  )
                )}
              </>
            )}

          </Box>
        ) : role === 'user' ? (
          // User message: right-aligned
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'flex-end',
              ml: 4
            }}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
          >
            <Box sx={{ 
              position: 'relative', 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 0.5,
              maxWidth: '70%'
            }}>
              {/* Selected files */}
              {message.selectedFiles && message.selectedFiles.length > 0 && (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 0.5,
                  mb: 0.5,
                  width: '100%'
                }}>
                  {/* File list */}
                  <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    justifyContent: 'flex-end',
                    maxWidth: '100%'
                  }}>
                    {(fileCollapsedState[index] !== false && message.selectedFiles.length > 3 ? 
                      message.selectedFiles.slice(0, 3) : 
                      message.selectedFiles
                    ).map((file, fileIndex) => (
                      <Chip
                        key={fileIndex}
                        icon={<DescriptionIcon />}
                        label={file.filename}
                        size="small"
                        onClick={() => handleFileClick(file.filepath)}
                        sx={{
                          bgcolor: '#e3f2fd',
                          color: '#1976d2',
                          maxWidth: '180px',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: '#bbdefb',
                          },
                          '& .MuiChip-label': {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }
                        }}
                      />
                    ))}
                    
                    {/* Collapse/expand button */}
                    {message.selectedFiles.length > 3 && (
                      <Chip
                        icon={fileCollapsedState[index] !== false ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                        label={fileCollapsedState[index] !== false ? 
                          `+${message.selectedFiles.length - 3}` : 
                          'Collapse'
                        }
                        size="small"
                        onClick={() => toggleFileCollapse(index)}
                        sx={{
                          bgcolor: '#f5f5f5',
                          color: '#666',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: '#eeeeee',
                          }
                        }}
                      />
                    )}
                  </Box>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {editingIndex === index ? (
                  // Edit mode
                  <Box sx={{ flexGrow: 1, minWidth: '300px' }}>
                    <TextField
                      fullWidth
                      multiline
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      autoFocus
                      variant="outlined"
                      size="small"
                      sx={{ mb: 1 }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button size="small" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button 
                        size="small" 
                        variant="contained" 
                        onClick={handleSaveEdit}
                        disabled={!editingContent.trim()}
                      >
                        Send
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  // Normal display
                  <>
                    {/* Edit button, shown to the left of the message */}
                    {onEditMessage && currentChatId && (
                      <IconButton
                        size="small"
                        onClick={() => handleStartEdit(index, content)}
                        sx={{ 
                          opacity: hoveredMessageIndex === index ? 1 : 0,
                          transition: 'opacity 0.1s ease-in-out', // Reduced from 0.2s to 0.1s
                          mr: 0.5, // Reduced from 1 to 0.5 so the icon sits closer to the bubble
                          mt: 0.5
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    
                    <Paper 
                      elevation={0}
                      sx={{ 
                        px: 2, // Keep horizontal padding
                        paddingTop: 2,
                        paddingBottom: 0,
                        borderRadius: 2,
                        bgcolor: '#f5f5f5', // Gray background
                        color: '#333333', // Dark gray text
                        maxWidth: 'fit-content',
                        minWidth: '80px',
                        wordBreak: 'break-word'
                      }}
                    >
                      <MarkdownRenderer content={content} className="markdown-content" />
                    </Paper>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        ) : (
          // System message: centered
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Paper 
              elevation={0}
              className={role === 'system' ? 'system-message-fadeout' : ''}
              sx={{ 
                p: 2, 
                borderRadius: 2,
                bgcolor: uploading ? '#e3f2fd' : '#fef3c7', // Blue background while uploading
                color: 'inherit',
                maxWidth: '80%',
                wordBreak: 'break-word'
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                {uploading && uploadProgress ? (
                  // File upload status
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={20} color="primary" />
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#1976d2' }}>
                        Files are uploading. Do not interact with or leave this page, or the upload will fail.
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Progress: {uploadProgress.completed} / {uploadProgress.total} 
                      {uploadProgress.current && ` (Current: ${uploadProgress.current})`}
                    </Typography>
                    <Box sx={{ 
                      width: '200px', 
                      height: '4px', 
                      bgcolor: '#e0e0e0', 
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <Box 
                        sx={{ 
                          height: '100%', 
                          bgcolor: '#1976d2',
                          borderRadius: '2px',
                          transition: 'width 0.3s ease',
                          width: `${(uploadProgress.completed / uploadProgress.total) * 100}%`
                        }}
                      />
                    </Box>
                  </Box>
                ) : uploading ? (
                  // Simple upload status (no progress details)
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                    <CircularProgress size={20} color="primary" />
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#1976d2' }}>
                      Files are uploading. Do not interact with or leave this page, or the upload will fail.
                    </Typography>
                  </Box>
                ) : (
                  <MarkdownRenderer content={content} className="markdown-content" />
                )}
              </Box>
            </Paper>
          </Box>
        )}
      </Box>
    );
  };

  // Function to render empty state with logo
  const renderEmptyState = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '400px',
          // opacity: 0.8,
          userSelect: 'none'
        }}
      >
        <Box
          component="img"
          src="/logo_1.png"
          alt="Logo"
          sx={{
            transform: 'scale(0.6)',
            transformOrigin: 'center', // Adjust the scale origin if needed
          }}
        />
        <Typography
          variant="h6"
          sx={{
            color: '#64748b',
            fontSize: '1.1rem',
            fontWeight: 500,
            textAlign: 'center'
          }}
        >
          Start a new conversation
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#94a3b8',
            fontSize: '0.9rem',
            textAlign: 'center',
            mt: 0.5
          }}
        >
          Type a message or upload a document to begin
        </Typography>
      </Box>
    );
  };

  return (
    <Box 
      sx={{ 
        width: '100%',
        position: 'relative',
        height: '100%'
      }}
    >
      {/* Drag overlay */}
      {/* {dragActive && !disableDrag && (
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
            zIndex: 10,
            backdropFilter: 'blur(2px)',
            pointerEvents: 'none',
            minHeight: '200px'
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 60, color: '#2563eb', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#2563eb', fontWeight: 600 }}>
            Drop files to upload
          </Typography>
          <Typography variant="body2" sx={{ color: '#2563eb', mt: 1 }}>
            Supports PDF, DOCX, TXT, CSV, and more
          </Typography>
        </Box>
      )} */}
      
      {/* Render empty state or messages */}
      {messages.length === 0 ? (
        renderEmptyState()
      ) : (
        messages.map((message, index) => renderMessage(message, index))
      )}
    </Box>
  );
};

export default ChatMessages; 