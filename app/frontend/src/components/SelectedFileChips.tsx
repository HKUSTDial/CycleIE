import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';

interface SelectedFileChipsProps {
  files: {
    filename: string;
    filepath: string;
  }[];
  onRemove: (filepath: string) => void;
}

const SelectedFileChips: React.FC<SelectedFileChipsProps> = ({ files, onRemove }) => {
  // Get icon based on file type
  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    if (extension === 'pdf') {
      return <PictureAsPdfIcon fontSize="small" />;
    } else if (['csv', 'xlsx', 'xls'].includes(extension)) {
      return <TableChartIcon fontSize="small" />;
    } else {
      return <DescriptionIcon fontSize="small" />;
    }
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 1, 
        mb: 2,
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      {/* <Typography 
        variant="caption" 
        color="text.secondary"
        sx={{ 
          width: '100%', 
          mb: 0.5,
          display: 'block'
        }}
      >
        Selected files for conversation:
      </Typography> */}
      
      {files.map((file) => (
        <Chip
          key={file.filepath}
          label={file.filename}
          onDelete={() => onRemove(file.filepath)}
          icon={getFileIcon(file.filename)}
          size="small"
          sx={{
            '& .MuiChip-deleteIcon': {
              opacity: 0,
              transition: 'opacity 0.2s',
            },
            '&:hover .MuiChip-deleteIcon': {
              opacity: 1,
            }
          }}
        />
      ))}
    </Box>
  );
};

export default SelectedFileChips; 