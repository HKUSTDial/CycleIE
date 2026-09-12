import React, { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';

// Styled version of DeleteIcon with white color
const WhiteDeleteIcon = styled(DeleteIcon)({
  color: '#FFFFFF',
});

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  _file?: File;
}

interface FileUploaderProps {
  onFileUpload: (files: UploadedFile[]) => void;
  uploadedFiles: UploadedFile[];
  isUploading: boolean;
  onDeleteFile?: (fileId: string) => void;
  hideUploadedFilesList?: boolean;
}

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, uploadedFiles, isUploading, onDeleteFile, hideUploadedFilesList = false }) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    const fileArray: UploadedFile[] = Array.from(files).map(file => ({
      id: `${file.name}-${Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      _file: file
    }));
    
    onFileUpload(fileArray);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Paper elevation={3} sx={{ p: 2, mb: 2, height: '100%' }}>
      {/* <Typography variant="h6" gutterBottom>
        Upload Documents
      </Typography> */}
      
      <Box
        sx={{
          border: '2px dashed',
          borderColor: dragActive ? 'primary.main' : 'divider',
          borderRadius: 1,
          p: 3,
          textAlign: 'center',
          bgcolor: dragActive ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s ease',
          mb: 2
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
        <Typography variant="body1" gutterBottom>
          Drag and drop files here, or
        </Typography>
        <Button
          component="label"
          variant="contained"
          startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          Browse Files
          <VisuallyHiddenInput 
            ref={inputRef}
            type="file" 
            multiple 
            onChange={handleChange} 
          />
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Supports PDF, DOCX, TXT, CSV and many other document formats
        </Typography>
      </Box>

      {uploadedFiles.length > 0 && !hideUploadedFilesList && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Uploaded Files
          </Typography>
          <List dense>
            {uploadedFiles.map((file) => (
              <ListItem
                key={file.id}
                secondaryAction={
                  <IconButton 
                    edge="end" 
                    aria-label="delete" 
                    disabled={isUploading}
                    onClick={() => onDeleteFile && onDeleteFile(file.id)}
                    sx={{ 
                      backgroundColor: 'error.main',
                      '&:hover': {
                        backgroundColor: 'error.dark',
                      }
                    }}
                  >
                    <WhiteDeleteIcon />
                  </IconButton>
                }
              >
                <ListItemIcon>
                  <InsertDriveFileIcon />
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={formatFileSize(file.size)}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  );
};

export default FileUploader; 