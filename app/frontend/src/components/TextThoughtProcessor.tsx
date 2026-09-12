import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';

interface TextThoughtProcessorProps {
  thoughtProcess: string[];
}

const TextThoughtProcessor: React.FC<TextThoughtProcessorProps> = ({ thoughtProcess }) => {
  if (!thoughtProcess || thoughtProcess.length === 0) {
    return null;
  }

  // Clean the thought process text
  const cleanThoughtProcess = thoughtProcess.map(thought => {
    return thought
      .replace('[THINKING]', 'Thinking: ')
      .replace('[SEARCH]', 'Search: ')
      .replace('[EXTRACT]', 'Extract: ')
      .replace('[VERIFY]', 'Verify: ')
      .replace('[REASON]', 'Reason: ')
      .replace('[DECISION]', 'Decision: ')
      .replace('[REFINE]', 'Refine: ')
      .replace('[TEMP]', '');
  });

  return (
    <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Thinking Process
        </Typography>
        <Typography variant="body2" color="text.secondary">
          
        </Typography>
      </Box>

      <Box sx={{ mt: 2, p: 2, bgcolor: 'transparent', borderRadius: 1 }}>
        {cleanThoughtProcess.map((thought, index) => (
          <Box key={index} sx={{ mb: 2 }}>
            <Typography 
              variant="body2" 
              component="pre"
              sx={{ 
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                p: 1
              }}
            >
              {thought}
            </Typography>
            {index < cleanThoughtProcess.length - 1 && (
              <Box 
                sx={{ 
                  height: '1px', 
                  bgcolor: 'divider', 
                  my: 1.5,
                  width: '100%' 
                }} 
              />
            )}
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default TextThoughtProcessor; 