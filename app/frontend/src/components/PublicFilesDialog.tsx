import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import PublicIcon from '@mui/icons-material/Public';
import { alpha } from '@mui/material/styles';

interface PublicFile {
  filename: string;
  filepath: string;
  size: number;
}

interface PublicFilesDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (filepaths: string[]) => void;
}

const PublicFilesDialog: React.FC<PublicFilesDialogProps> = ({ open, onClose, onImport }) => {
  const [files, setFiles] = useState<PublicFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // Fetch the public files list
  const fetchPublicFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/public-files');
      if (!response.ok) {
        throw new Error('Failed to fetch public files');
      }
      
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle a file's selection
  const handleToggleFile = (filepath: string) => {
    setSelectedFiles(prev => {
      if (prev.includes(filepath)) {
        return prev.filter(f => f !== filepath);
      } else {
        return [...prev, filepath];
      }
    });
  };

  // Select or deselect all
  const handleToggleAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.filepath));
    }
  };

  // Import the selected files
  const handleImportSelected = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setImporting(true);
    setError(null);
    
    try {
      await onImport(selectedFiles);
      onClose(); // Close the dialog after a successful import
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // Format a file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Icon for a file type
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

  useEffect(() => {
    if (open) {
      fetchPublicFiles();
      setSelectedFiles([]); // Reset selection
    }
  }, [open]);

  const isAllSelected = files.length > 0 && selectedFiles.length === files.length;
  const isIndeterminate = selectedFiles.length > 0 && selectedFiles.length < files.length;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: '500px'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        borderBottom: '1px solid #e1e5e9',
        pb: 2
      }}>
        <PublicIcon color="primary" />
        Import from public files
        {files.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            ({selectedFiles.length}/{files.length} selected)
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
        
        {loading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            py: 4 
          }}>
            <CircularProgress />
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            py: 4,
            color: 'text.secondary'
          }}>
            <PublicIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2">
              No files available in the public folder
            </Typography>
          </Box>
        ) : (
          <>
            {/* Select all */}
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #f0f2f5' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleToggleAll}
                  size="small"
                />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {isAllSelected ? 'Deselect all' : 'Select all'}
                </Typography>
              </Box>
            </Box>
            
            {/* File list */}
            <List sx={{ py: 0, maxHeight: '300px', overflowY: 'auto' }}>
              {files.map((file, index) => (
                <ListItem 
                  key={index} 
                  disablePadding
                  sx={{
                    '&:hover': {
                      bgcolor: alpha('#2563eb', 0.08)
                    }
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      py: 1.5,
                      px: 2,
                      cursor: 'pointer'
                    }}
                    onClick={() => handleToggleFile(file.filepath)}
                  >
                    <Checkbox
                      checked={selectedFiles.includes(file.filepath)}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getFileIcon(file.filename)}
                    </ListItemIcon>
                    <ListItemText 
                      primary={file.filename}
                      secondary={formatFileSize(file.size)}
                      primaryTypographyProps={{ 
                        variant: 'body2',
                        fontWeight: 500
                      }}
                      secondaryTypographyProps={{ 
                        variant: 'caption',
                        color: 'text.secondary'
                      }}
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e1e5e9' }}>
        <Button onClick={onClose} variant="outlined" size="small">
          Cancel
        </Button>
        <Button 
          onClick={handleImportSelected}
          variant="contained" 
          size="small"
          disabled={selectedFiles.length === 0 || importing}
          startIcon={importing ? <CircularProgress size={16} /> : null}
        >
          {importing ? 'Importing...' : `Import (${selectedFiles.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PublicFilesDialog; 