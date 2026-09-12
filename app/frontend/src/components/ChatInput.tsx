import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';

interface ChatInputProps {
  onSubmit: (query: string) => void;
  isProcessing: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSubmit, isProcessing }) => {
  const [input, setInput] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSubmit(input);
      setInput('');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Enter your question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isProcessing}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              backgroundColor: 'background.paper',
            }
          }}
        />
        <Button
          variant="contained"
          color="primary"
          type="submit"
          disabled={isProcessing || !input.trim()}
          sx={{ 
            height: '56px', 
            width: '56px', 
            minWidth: '56px',
            borderRadius: '50%'
          }}
        >
          {isProcessing ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <img src="public/arrow.png" alt="Send" style={{ width: '12px', height: '12px' }} />
          )}
        </Button>
      </Box>
    </Box>
  );
};

export default ChatInput; 