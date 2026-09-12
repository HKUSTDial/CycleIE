import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { keyframes } from '@mui/system';
import SearchIcon from '@mui/icons-material/Search';
import MemoryIcon from '@mui/icons-material/Memory';
import PsychologyIcon from '@mui/icons-material/Psychology';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface LiveThinkingRendererProps {
  thoughtProcess: string[];
  isThinking: boolean;
  finalContent?: string; // Final answer content
  showFinalContent?: boolean; // Whether to show the final answer
  filterConfig?: {
    maxThoughts?: number; // Maximum number of thought steps to show
    keywordFilters?: string[]; // Keyword filters
    excludeTypes?: string[]; // Types to exclude
    coherenceMode?: boolean; // Whether to stitch thoughts into continuous prose
  };
}

interface ProcessedThought {
  content: string;
  type: string;
  icon: React.ReactNode;
  color: string;
  label: string;
  isKeyPoint: boolean; // Whether this is a key point
  extractedContent?: string; // Extracted key content
  importance: number; // Importance score (1-10)
}

// Pulse animation
const pulse = keyframes`
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.8;
  }
`;

// Fade-in animation
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// Add transitional phrases
const getTransitionPhrase = (prevType: string, currentType: string): string => {
  const transitions: { [key: string]: { [key: string]: string } } = {
    'thinking': {
      'search': 'in order to verify this idea, I need to',
      'extract': 'based on this idea, I',
      'verify': 'in order to confirm this, I',
      'action': 'therefore, I decided'
    },
    'search': {
      'thinking': 'I found that',
      'extract': 'I extracted from the search results',
      'verify': 'in order to further confirm',
      'action': 'based on the search results'
    },
    'extract': {
      'thinking': 'after extracting information, I think',
      'search': 'this makes me want to know more',
      'verify': 'in order to verify the extracted information',
      'action': 'based on these information'
    },
    'verify': {
      'thinking': 'the verification result shows',
      'search': 'this requires me to continue to find',
      'extract': 'now I need',
      'action': 'based on the verification result'
    },
    'action': {
      'thinking': 'after executing, I found',
      'search': 'this makes me',
      'extract': 'next I want to',
      'verify': 'in order to ensure correctness'
    }
  };
  
  return transitions[prevType]?.[currentType] || '';
};

// Process the thought stream and extract content
const processThoughts = (thoughtProcess: string[], filterConfig?: LiveThinkingRendererProps['filterConfig']): ProcessedThought[] => {
  if (!thoughtProcess || !Array.isArray(thoughtProcess)) return [];

  // Drop debug messages that should not be shown
  const filteredThoughtProcess = thoughtProcess.filter(thought => {
    // Drop messages matching these patterns
    const filterPatterns = [
      /^Starting analysis for query:/i,
      /^Loading and processing documents/i,
      /Structure selection result:/i,
      /Verification Result:/i,
      /^Documents load and process finished/i,
      /^I will use the following query for search/i,
    ];
    
    return !filterPatterns.some(pattern => pattern.test(thought.trim()));
  });

  const processedThoughts = filteredThoughtProcess.map(thought => {
    // Determine the thought type
    let type = 'thinking';
    let icon = <PsychologyIcon fontSize="small" />;
    let color = 'primary';
    let label = 'Thinking';
    
         if (thought.includes('[SEARCH]')) {
       type = 'search';
       icon = <SearchIcon fontSize="small" />;
       color = 'secondary';
       label = 'Retrieval';
     } else if (thought.includes('[EXTRACT]')) {
       type = 'extract';
       icon = <MemoryIcon fontSize="small" />;
       color = 'warning';
       label = 'Extract';
     } else if (thought.includes('[VERIFY]')) {
       type = 'verify';
       icon = <FactCheckIcon fontSize="small" />;
       color = 'success';
       label = 'Verify';
     } else if (thought.includes('[REASON]')) {
       type = 'reason';
       icon = <CheckCircleIcon fontSize="small" />;
       color = 'primary';
       label = 'Reason';
     } else if (thought.includes('[DECISION]') || thought.includes('[REFINE]')) {
       type = 'action';
       icon = <AutoFixHighIcon fontSize="small" />;
       color = 'info';
       label = 'Decision';
     }

         // Strip all markers and keep plain text
     let cleanedContent = thought
       .replace('[TEMP]', '')
       .replace('[THINKING]', '')
       .replace('[SEARCH]', '')
       .replace('[EXTRACT]', '')
       .replace('[VERIFY]', '')
       .replace('[REASON]', '')
       .replace('[DECISION]', '')
       .replace('[REFINE]', '')
       .trim();

    // Filter out remaining debug messages
    if (cleanedContent.startsWith('Starting analysis for') ||
        cleanedContent.startsWith('Loading and processing') ||
        cleanedContent.includes('Structure selection result:') ||
        cleanedContent.includes('Verification Result:')) {
      cleanedContent = '';
    }
    
    // Treat any non-empty content as a key point
    const isKeyPoint = cleanedContent.length > 0;

    return {
      content: thought,
      type,
      icon,
      color,
      label,
      isKeyPoint,
      extractedContent: cleanedContent,
      importance: 1
    };
  });

  // Apply filters
  let filteredThoughts = processedThoughts;
  
  if (filterConfig) {
    // Exclude the given types
    if (filterConfig.excludeTypes) {
      filteredThoughts = filteredThoughts.filter(
        thought => !filterConfig.excludeTypes!.includes(thought.type)
      );
    }
    
    // Keyword filter
    if (filterConfig.keywordFilters) {
      filteredThoughts = filteredThoughts.filter(thought =>
        filterConfig.keywordFilters!.some(keyword => 
          thought.extractedContent?.includes(keyword)
        )
      );
    }
    
    // Sort by importance and cap the count
    if (filterConfig.maxThoughts) {
      filteredThoughts = filteredThoughts
        .sort((a, b) => b.importance - a.importance)
        .slice(0, filterConfig.maxThoughts);
    }
    
    // Drop thought steps with empty content
    filteredThoughts = filteredThoughts.filter(thought => thought.isKeyPoint);
  }

  return filteredThoughts;
};

const LiveThinkingRenderer: React.FC<LiveThinkingRendererProps> = ({
  thoughtProcess,
  isThinking,
  finalContent,
  showFinalContent = false,
  filterConfig = {
    maxThoughts: undefined, 
    excludeTypes: ['search', 'extract', 'verify', 'structure'], // exclude retrieval steps by default
    coherenceMode: true 
  }
}) => {
  const [displayedThoughts, setDisplayedThoughts] = useState<ProcessedThought[]>([]);
  const [showFinal, setShowFinal] = useState(false);

  const processedThoughts = processThoughts(thoughtProcess, filterConfig);

  // Update the displayed thought process live
  useEffect(() => {
    if (processedThoughts.length > displayedThoughts.length) {
      // Reveal new thought steps one at a time
      const timer = setTimeout(() => {
        setDisplayedThoughts(processedThoughts.slice(0, displayedThoughts.length + 1));
      }, 300); // wait 300ms before showing the next step

      return () => clearTimeout(timer);
    } else {
      setDisplayedThoughts(processedThoughts);
    }
  }, [processedThoughts.length, displayedThoughts.length]);

  // When thinking finishes and a final answer exists, show it
  useEffect(() => {
    if (!isThinking && showFinalContent && finalContent && displayedThoughts.length > 0) {
      const timer = setTimeout(() => {
        setShowFinal(true);
      }, 500); // wait 500ms after thinking finishes before showing the final answer

      return () => clearTimeout(timer);
    }
  }, [isThinking, showFinalContent, finalContent, displayedThoughts.length]);

  // Keep key points
  const keyPoints = displayedThoughts.filter(thought => thought.isKeyPoint);

  // Build a coherent display
  const buildCoherentContent = () => {
    if (!filterConfig?.coherenceMode) {

      return keyPoints.map(thought => thought.extractedContent).join('\n\n');
    }
    
    let content = '';
    let prevType = '';
    
    keyPoints.forEach((thought, index) => {
      if (thought.extractedContent) {
        // Add a transition
        if (index > 0 && prevType) {
          const transition = getTransitionPhrase(prevType, thought.type);
          if (transition) {
            content += transition + ': ';
          }
        }
        
        // Add the thought text
        content += thought.extractedContent;
        
        
        // Add spacing between paragraphs
        if (index < keyPoints.length - 1) {
          content += '\n\n';
        }
        
        prevType = thought.type;
      }
    });
    
    return content;
  };

  const displayContent = buildCoherentContent();

  return (
    <Box sx={{ width: '100%' }}>
      {/* While thinking and nothing has been shown yet */}
      {isThinking && keyPoints.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.5,
            animation: `${pulse} 2s infinite ease-in-out`
          }}
        >
          <PsychologyIcon fontSize="small" color="primary" />
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'primary.main',
              fontSize: '0.9rem',
              fontStyle: 'italic'
            }}
          >
            Analyzing the question...
          </Typography>
        </Box>
      )}

      {/* Show the coherent thought text */}
      {displayContent && (
        <Box
          sx={{
            animation: isThinking ? `${pulse} 2s infinite ease-in-out` : `${fadeIn} 0.5s ease-out`
          }}
        >
          <Box
            sx={{
              lineHeight: 1.6,
              color: '#0f172a',
              fontSize: '0.95rem',
              '& strong': { fontWeight: 'bold' },
              whiteSpace: 'pre-wrap',
              // Slightly tighter typography
              '& p': { marginBottom: '0.5rem' },
              textAlign: 'justify'
            }}
            dangerouslySetInnerHTML={{ 
              __html: displayContent
                .replace(/\n\n/g, '</p><p>')
                .replace(/^/, '<p>')
                .replace(/$/, '</p>') 
            }}
          />
        </Box>
      )}

      {/* Show filter stats (development only)
      {process.env.NODE_ENV === 'development' && keyPoints.length > 0 && (
        <Box sx={{ mt: 1, opacity: 0.6 }}>
          <Typography variant="caption" color="text.secondary">
            Showing {keyPoints.length} of {thoughtProcess.length} thinking steps
          </Typography>
        </Box>
      )} */}
    </Box>
  );
};

export default LiveThinkingRenderer; 