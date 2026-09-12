import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CodeIcon from '@mui/icons-material/Code';
import ReactMarkdown from 'react-markdown';
import PsychologyIcon from '@mui/icons-material/Psychology';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export interface ProcessedThought {
  type: string;
  content: string;
  label: string;
  icon: React.ReactNode;
}

interface StepVisualizerProps {
  thoughtProcess: string[];
}

// Process and categorize thinking steps
const processThoughts = (thoughtProcess: string[]): ProcessedThought[] => {
  if (!thoughtProcess || !Array.isArray(thoughtProcess)) return [];

  return thoughtProcess.map(thought => {
    // Default
    let type = 'thinking';
    let icon = <PsychologyIcon fontSize="small" />;
    let label = 'Thinking';

    // Process based on flags
    if (thought.includes('[THINKING]')) {
      type = 'thinking';
      icon = <PsychologyIcon fontSize="small" />;
      label = 'Thinking';
    } else if (thought.includes('[SEARCH]')) {
      type = 'search';
      icon = <SearchIcon fontSize="small" />;
      label = 'Retrieval';
    } else if (thought.includes('[EXTRACT]')) {
      type = 'extract';
      icon = <MenuBookIcon fontSize="small" />;
      label = 'Extract';
    } else if (thought.includes('[VERIFY]')) {
      type = 'verify';
      icon = <ScienceIcon fontSize="small" />;
      label = 'Verify';
    } else if (thought.includes('[REASON]')) {
      type = 'reason';
      icon = <CodeIcon fontSize="small" />;
      label = 'Reason';
    } else if (thought.includes('[DECISION]') || thought.includes('[REFINE]')) {
      type = 'action';
      icon = <CodeIcon fontSize="small" />;
      label = 'Action';
    }

    return {
      content: thought,
      type,
      icon,
      label
    };
  });
};

const StepVisualizer: React.FC<StepVisualizerProps> = ({ thoughtProcess }) => {
  const steps = processThoughts(thoughtProcess);
  
  // State to track expanded/collapsed state for each step
  const [expandedStates, setExpandedStates] = useState<{[key: number]: boolean}>({});
  
  if (!steps || steps.length === 0) {
    return null;
  }
  
  // Toggle expanded/collapsed state
  const toggleExpand = (index: number) => {
    setExpandedStates(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  
  // Count lines in the content
  const countLines = (content: string): number => {
    return content.split('\n').length;
  };
  
  // Check if content should be collapsible
  const shouldBeCollapsible = (step: ProcessedThought): boolean => {
    // Only make Retrieval and Extract types collapsible
    if (step.type !== 'search' && step.type !== 'extract') {
      return false;
    }
    
    // Clean the content first
    const cleanContent = step.content
      .replace('[THINKING]', '')
      .replace('[SEARCH]', '')
      .replace('[EXTRACT]', '')
      .replace('[VERIFY]', '')
      .replace('[REASON]', '')
      .replace('[DECISION]', '')
      .replace('[REFINE]', '');
    
    // Check if it has more than 3 lines
    return countLines(cleanContent) > 3;
  };
  
  // Get display content based on expanded state
  const getDisplayContent = (step: ProcessedThought, index: number): string => {
    const cleanContent = step.content
      .replace('[THINKING]', '')
      .replace('[SEARCH]', '')
      .replace('[EXTRACT]', '')
      .replace('[VERIFY]', '')
      .replace('[REASON]', '')
      .replace('[DECISION]', '')
      .replace('[REFINE]', '');
    
    // If not collapsible or expanded, show full content
    if (!shouldBeCollapsible(step) || expandedStates[index]) {
      return cleanContent;
    }
    
    // Otherwise show first 3 lines
    const lines = cleanContent.split('\n');
    return lines.slice(0, 3).join('\n') + '\n...';
  };

  return (
    <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          AI Reasoning Process
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This visualizes the AI's step-by-step reasoning process
        </Typography>
      </Box>

      <Stepper 
        orientation="vertical" 
        sx={{ 
          mt: 2,
          '& .MuiStepConnector-line': {
            minHeight: 12,
            borderLeftWidth: 2,
            animation: 'verticalLineGrow 0.5s ease-out forwards',
            transformOrigin: 'top'
          }
        }}
      >
        {steps.map((step, index) => {
          const isCollapsible = shouldBeCollapsible(step);
          
          return (
            <Step key={index} active={true} completed={true}>
              <StepLabel StepIconComponent={() => (
                <Box component="span" sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'white',
                  zIndex: 1,
                  position: 'relative'
                }}>
                  {step.icon}
                </Box>
              )}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {step.label}
                  {isCollapsible && (
                    <IconButton 
                      size="small" 
                      onClick={() => toggleExpand(index)}
                      sx={{ ml: 1, p: 0.5 }}
                    >
                      {expandedStates[index] ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  )}
                </Box>
              </StepLabel>
              <StepContent>
                <Box sx={{ pl: 1, pt: 1, pb: 2 }}>
                  <ReactMarkdown>
                    {getDisplayContent(step, index)}
                  </ReactMarkdown>
                </Box>
              </StepContent>
            </Step>
          );
        })}
      </Stepper>
    </Paper>
  );
};

export default StepVisualizer; 