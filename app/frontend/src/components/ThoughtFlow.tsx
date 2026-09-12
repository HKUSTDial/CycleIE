import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CodeIcon from '@mui/icons-material/Code';
import ReactMarkdown from 'react-markdown';
import PsychologyIcon from '@mui/icons-material/Psychology';

export interface ProcessedThought {
  type: string;
  content: string;
  label: string;
  icon: React.ReactNode;
}

interface ThoughtFlowProps {
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
    } else if (thought.includes('[DECISION]') || thought.includes('[REFINE]') || thought.includes('[STRUCTURE]')) {
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

const ThoughtFlow: React.FC<ThoughtFlowProps> = ({ thoughtProcess }) => {
  const thoughts = processThoughts(thoughtProcess);
  
  if (!thoughts || thoughts.length === 0) {
    return null;
  }

  const getTimelineDotColor = (type: string): "primary" | "secondary" | "error" | "info" | "success" | "warning" | "grey" => {
    switch (type) {
      case 'thinking':
        return 'primary';
      case 'search':
        return 'secondary';
      case 'read':
        return 'info';
      case 'code':
        return 'success';
      case 'response':
        return 'warning';
      default:
        return 'grey';
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          AI Thought Process
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This timeline visualizes the AI's thought process
        </Typography>
      </Box>

      <Timeline position="right">
        {thoughts.map((thought, index) => (
          <TimelineItem key={index}>
            <TimelineSeparator>
              <TimelineDot color={getTimelineDotColor(thought.type)}>
                {thought.icon}
              </TimelineDot>
              {index < thoughts.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="subtitle2" component="span">
                {thought.label}
              </Typography>
              <Box sx={{ mt: 1, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                <ReactMarkdown>
                  {typeof thought.content === 'string' ? thought.content : JSON.stringify(thought.content)}
                </ReactMarkdown>
              </Box>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Paper>
  );
};

export default ThoughtFlow; 