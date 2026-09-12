import React from 'react';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import Box from '@mui/material/Box';

interface FileListProps {
  files: {
    filename: string;
    size: number;
    filepath?: string;
  }[];
  selectable?: boolean;
  onFileSelect?: (filepath: string) => void;
  selectedFiles?: string[];
  showActionButtons?: boolean;
  onJoinAnalysis?: (filepath: string) => void;
  onDeleteFile?: (filepath: string) => void;
}

const FileList: React.FC<FileListProps> = ({ files, selectable = false, onFileSelect, selectedFiles = [], showActionButtons = false, onJoinAnalysis, onDeleteFile }) => {
  if (!files || files.length === 0) {
    return (
      <Paper
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: 'background.paper',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '120px',
        }}
      >
        <Typography variant="body2" color="text.secondary" align="center">
          No files uploaded yet
        </Typography>
      </Paper>
    );
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get icon based on file type
  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    if (extension === 'pdf') {
      return <PictureAsPdfIcon color="error" />;
    } else if (['csv', 'xlsx', 'xls'].includes(extension)) {
      return <TableChartIcon color="success" />;
    } else {
      return <DescriptionIcon color="primary" />;
    }
  };

  const handleToggle = (filepath: string) => {
    if (selectable && onFileSelect && filepath) {
      onFileSelect(filepath);
    }
  };

  return (
    <Paper
      sx={{
        p: 1,
        borderRadius: 2,
        bgcolor: 'background.paper',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '252px', // Match height with Upload Documents area
        overflowY: 'auto'
      }}
    >
      {/* <Typography variant="subtitle2" sx={{ px: 2, py: 1 }}>
        {selectable ? "File Base" : "Uploaded Files"} ({files.length})
      </Typography> */}
      
      
      <List dense sx={{ p: 0 }}>
        {files.map((file, index) => (
          <ListItem 
            key={index} 
            sx={{ py: 0.5, cursor: selectable ? 'pointer' : 'default' }}
            onClick={() => file.filepath && !showActionButtons && handleToggle(file.filepath)}
            secondaryAction={
              showActionButtons && file.filepath ? (
                <Box>
                  <IconButton 
                    edge="end" 
                    aria-label="join" 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJoinAnalysis && file.filepath && onJoinAnalysis(file.filepath);
                    }}
                    sx={{ mr: 1 }}
                  >
                    <AddCircleIcon color="primary" />
                  </IconButton>
                  <IconButton 
                    edge="end" 
                    aria-label="delete" 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile && file.filepath && onDeleteFile(file.filepath);
                    }}
                  >
                    <DeleteIcon color="error" />
                  </IconButton>
                </Box>
              ) : undefined
            }
          >
            {selectable && file.filepath && !showActionButtons && (
              <Checkbox
                edge="start"
                checked={selectedFiles.includes(file.filepath)}
                tabIndex={-1}
                disableRipple
              />
            )}
            <ListItemIcon sx={{ minWidth: 40 }}>
              {getFileIcon(file.filename)}
            </ListItemIcon>
            <ListItemText 
              primary={file.filename} 
              secondary={formatFileSize(file.size)} 
              primaryTypographyProps={{ 
                variant: 'body2',
                noWrap: true,
                sx: { maxWidth: showActionButtons ? '110px' : '150px' } 
              }}
              secondaryTypographyProps={{ 
                variant: 'caption',
                color: 'text.secondary' 
              }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default FileList; 