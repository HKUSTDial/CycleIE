import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { keyframes } from '@mui/system';
import SearchIcon from '@mui/icons-material/Search';
import MemoryIcon from '@mui/icons-material/Memory';
import PsychologyIcon from '@mui/icons-material/Psychology';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

interface ThinkingProgressProps {
  thoughtProcess: string[];
  isThinking: boolean;
  onClick?: () => void;
}

// Pulse animation
const pulse = keyframes`
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
`;

// Drop debug messages that should not be shown
const filterDebugMessages = (thoughts: string[]): string[] => {
  if (!thoughts || !Array.isArray(thoughts)) return [];
  
  return thoughts.filter(thought => {
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
};

// Current in-progress step
const getCurrentStep = (thoughtProcess: string[]): { label: string; icon: React.ReactNode; color: string } => {
  if (!thoughtProcess || thoughtProcess.length === 0) {
    return { label: 'Thinking', icon: <PsychologyIcon fontSize="small" />, color: 'primary' };
  }

  const lastThought = thoughtProcess[thoughtProcess.length - 1];
  
  // Check whether this is a temporary thought (contains the [TEMP] marker)
  const isTemporary = lastThought.includes('[TEMP]');
  
  if (isTemporary || lastThought.includes('[THINKING]')) {
    return { label: 'Thinking', icon: <PsychologyIcon fontSize="small" />, color: 'primary' };
  } else if (lastThought.includes('[SEARCH]')) {
    return { label: 'Searching', icon: <SearchIcon fontSize="small" />, color: 'secondary' };
  } else if (lastThought.includes('[EXTRACT]')) {
    return { label: 'Extracting', icon: <MemoryIcon fontSize="small" />, color: 'warning' };
  } else if (lastThought.includes('[VERIFY]')) {
    return { label: 'Verifying', icon: <FactCheckIcon fontSize="small" />, color: 'success' };
  } else if (lastThought.includes('[DECISION]') || lastThought.includes('[REFINE]')) {
    return { label: 'Processing', icon: <AutoFixHighIcon fontSize="small" />, color: 'info' };
  }
  
  return { label: 'Reasoning', icon: <PsychologyIcon fontSize="small" />, color: 'primary' };
};

const ThinkingProgress: React.FC<ThinkingProgressProps> = ({
  thoughtProcess,
  isThinking,
  onClick
}) => {
  if (!isThinking && (!thoughtProcess || thoughtProcess.length === 0)) {
    return null;
  }

  // Filter out debug messages
  const filteredThoughtProcess = filterDebugMessages(thoughtProcess);
  
  const currentStep = getCurrentStep(filteredThoughtProcess);
  const stepCount = filteredThoughtProcess ? filteredThoughtProcess.length : 0;
  
  // Pulse only while thinking and not in the Processing state
  const shouldShowPulse = isThinking && currentStep.label !== 'Processing';
  // Show the spinner only while thinking; keep it static in the Processing state
  const shouldShowProgress = isThinking;
  // Do not animate the spinner in the Processing state
  const isProcessing = currentStep.label === 'Processing';

  return (
    <Box 
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        mb: 2,
        backgroundColor: '#f8fafc',
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        animation: shouldShowPulse ? `${pulse} 2s infinite ease-in-out` : 'none',
        '&:hover': onClick ? {
          backgroundColor: '#f1f5f9',
          borderColor: '#cbd5e1',
          transform: 'translateY(-1px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        } : {}
      }}
    >
      {/* Loading indicator */}
      {shouldShowProgress && (
        <CircularProgress 
          size={16} 
          sx={{ 
            color: currentStep.color === 'primary' ? 'primary.main' : 
                   currentStep.color === 'secondary' ? 'secondary.main' :
                   currentStep.color === 'warning' ? 'warning.main' :
                   currentStep.color === 'success' ? 'success.main' :
                   currentStep.color === 'info' ? 'info.main' : 'primary.main',
            // Disable the spin animation in the Processing state
            animation: isProcessing ? 'none' : 'mui-CircularProgress-keyframes-circular-rotate 1.4s linear infinite'
          }} 
        />
      )}
      
      {/* Current step label */}
      <Chip
        icon={React.cloneElement(currentStep.icon as React.ReactElement)}
        label={currentStep.label}
        color={currentStep.color as any}
        size="small"
        variant={isThinking ? 'filled' : 'outlined'}
        sx={{ 
          fontSize: '0.75rem',
          height: '24px'
        }}
      />
      
      {/* Step count */}
      <Typography 
        variant="caption" 
        sx={{ 
          color: 'text.secondary',
          fontSize: '0.75rem'
        }}
      >
        {stepCount > 0 ? `${stepCount} steps` : 'Starting...'}
      </Typography>
      
      {/* Click hint */}
      {onClick && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'primary.main',
            fontSize: '0.7rem',
            fontStyle: 'italic',
            ml: 'auto'
          }}
        >
          View Details
        </Typography>
      )}
    </Box>
  );
};

export default ThinkingProgress; 