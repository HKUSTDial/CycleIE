import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PublicIcon from '@mui/icons-material/Public';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import '../styles/ChatHistoryPanel.css';
import PublicFilesDialog from './PublicFilesDialog';

interface FileItem {
  filename: string;
  filepath: string;
  size: number;
}

interface FileLibraryWithUploadProps {
  files: FileItem[];
  selectable?: boolean;
  onFileSelect?: (filepath: string) => void;
  selectedFiles?: string[];
  onFileUpload?: (files: File[]) => void;
  onDeleteFile?: (filepath: string) => void;
  onRefreshFiles?: () => void;
  onSelectAll?: () => void;
  onFileRead?: (filepath: string) => void;
  onNewChat?: () => void;
  isUploading?: boolean;
  isRefreshing?: boolean;
  onPublicFileImport?: () => void;
  projectId?: string;
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

const FileLibraryWithUpload: React.FC<FileLibraryWithUploadProps> = ({
  files,
  selectable = false,
  onFileSelect,
  selectedFiles = [],
  onFileUpload,
  onDeleteFile,
  onRefreshFiles,
  onSelectAll,
  onFileRead,
  onNewChat,
  isUploading = false,
  isRefreshing = false,
  onPublicFileImport,
  projectId
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [dragCounter, setDragCounter] = useState<number>(0);
  const [uploadMenuAnchor, setUploadMenuAnchor] = useState<null | HTMLElement>(null);
  const [publicFilesDialogOpen, setPublicFilesDialogOpen] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Supported file formats
  const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'md', 'csv', 'xlsx', 'xls'];

  // Ensure the folder input has the correct attributes
  useEffect(() => {
    if (folderInputRef.current) {
      (folderInputRef.current as any).webkitdirectory = true;
      (folderInputRef.current as any).directory = true;
    }
  }, []);

  const isValidFile = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return SUPPORTED_EXTENSIONS.includes(extension);
  };

  const handleFiles = (fileList: FileList) => {
    if (onFileUpload) {
      const fileArray = Array.from(fileList);
      
      // Debug: log file info
      fileArray.forEach((file, index) => {
      });
      
      // Fix filenames when uploading a folder
      const processedFiles = fileArray.map(file => {
        // Files selected via webkitdirectory need a new File object
        if ((file as any).webkitRelativePath) {
          // Extract the filename from the relative path (Unix and Windows separators)
          const fileName = file.name.split(/[/\\]/).pop() || file.name;
          
          // Create a new File with only the filename, not the path
          const newFile = new File([file], fileName, {
            type: file.type,
            lastModified: file.lastModified
          });
          
          return newFile;
        }
        return file;
      });
      
      // Keep only supported file types
      const validFiles = processedFiles.filter(isValidFile);
      if (validFiles.length > 0) {
        onFileUpload(validFiles);
      }
      if (validFiles.length !== fileArray.length) {
        // Warn if some files were unsupported
        console.warn(`Skipped ${fileArray.length - validFiles.length} unsupported file(s)`);
      }
    }
  };

  // Handle folder selection
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const fileList = e.target.files;
      handleFiles(fileList);
    }
  };

  // Handle upload button click
  const handleUploadClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setUploadMenuAnchor(event.currentTarget);
  };

  // Close the upload menu
  const handleUploadMenuClose = () => {
    setUploadMenuAnchor(null);
  };

  // Upload selected files
  const handleSelectFiles = () => {
    handleUploadMenuClose();
    inputRef.current?.click();
  };

  // Upload a selected folder
  const handleSelectFolder = () => {
    handleUploadMenuClose();
    // Ensure webkitdirectory is set
    if (folderInputRef.current) {
      (folderInputRef.current as any).webkitdirectory = true;
      folderInputRef.current.click();
    }
  };

  // Open the public files dialog
  const handleOpenPublicFiles = () => {
    handleUploadMenuClose();
    setPublicFilesDialogOpen(true);
  };

  // Import public files
  const handleImportPublicFiles = async (filepaths: string[]) => {
    try {
      const apiUrl = projectId 
        ? `/api/projects/${projectId}/public-files/import`
        : '/api/public-files/import';
        
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filepaths }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }

      const result = await response.json();
      
      // Refresh the file list after a successful import
      if (onRefreshFiles) {
        onRefreshFiles();
      }
      
      // Notify the parent
      if (onPublicFileImport) {
        onPublicFileImport();
      }
      
      
      // Build a summary of the import result
      if (result.summary) {
        const { imported_count, existing_count, failed_count } = result.summary;
        let message = '';
        if (imported_count > 0) {
          message += `Successfully imported ${imported_count} files`;
        }
        if (existing_count > 0) {
          message += `${message ? ', ' : ''}${existing_count} files already exist`;
        }
        if (failed_count > 0) {
          message += `${message ? ', ' : ''}${failed_count} files failed to import`;
        }
      }
      
    } catch (error) {
      console.error('Import error:', error);
      throw error; // Re-throw so the dialog can handle it
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  // Whether a folder is being dragged
  const isDraggingFolder = (dataTransfer: DataTransfer): boolean => {
    return Array.from(dataTransfer.items).some(item => {
      const entry = item.webkitGetAsEntry?.();
      return entry?.isDirectory;
    });
  };

  // Recursively collect files from a folder
  const processDirectoryEntry = async (dirEntry: any): Promise<File[]> => {
    const files: File[] = [];
    
    const readEntries = (dirReader: any): Promise<any[]> => {
      return new Promise((resolve) => {
        dirReader.readEntries((entries: any[]) => {
          resolve(entries);
        });
      });
    };

    const dirReader = dirEntry.createReader();
    const entries = await readEntries(dirReader);
    
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => {
          entry.file((file: File) => resolve(file));
        });
        if (isValidFile(file)) {
          files.push(file);
        }
      } else if (entry.isDirectory) {
        // Recurse into subdirectories
        const subFiles = await processDirectoryEntry(entry);
        files.push(...subFiles);
      }
    }
    
    return files;
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragActive(false);
    setDragCounter(0);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const allFiles: File[] = [];
      
      // Process dropped items
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        const entry = item.webkitGetAsEntry?.();
        
        if (entry) {
          if (entry.isFile) {
            // Handle a single file
            const file = item.getAsFile();
            if (file && isValidFile(file)) {
              allFiles.push(file);
            }
          } else if (entry.isDirectory) {
            // Handle a folder
            try {
              const folderFiles = await processDirectoryEntry(entry);
              allFiles.push(...folderFiles);
            } catch (error) {
              console.error('Error processing folder:', error);
            }
          }
        }
      }
      
      if (allFiles.length > 0 && onFileUpload) {
        // Debug: log dropped file info
        allFiles.forEach((file, index) => {
        });
        
        onFileUpload(allFiles);
      }
      
      e.dataTransfer.clearData();
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Fallback: use the file list directly
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setDragActive(false);
      }
      return newCounter;
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

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

  // Open a file for reading
  const handleFileRead = (filepath: string) => {
    if (onFileRead) {
      onFileRead(filepath);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* New chat button */}
      {onNewChat && (
        <div className="chat-history-actions">
          <button 
            className="new-chat-button"
            onClick={onNewChat}
            title="New chat"
            style={{ backgroundColor: '#000000', color: '#ffffff', fontSize: '12px' }}
          >
            <AddIcon style={{ fontSize: 12 }} />
            New chat
          </button>
        </div>
      )}

      {/* File library */}
      <Paper
        elevation={1}
        sx={{
          position: 'relative',
          borderRadius: 3,
          border: '1px solid #e1e5e9',
          bgcolor: '#ffffff',
          transition: 'all 0.2s ease',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {/* Drag overlay */}
        {dragActive && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: alpha('#2563eb', 0.1),
              borderRadius: 3,
              border: '2px dashed #2563eb',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 60, color: '#2563eb', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#2563eb', fontWeight: 600 }}>
              Drop files or folders to upload
            </Typography>
            <Typography variant="body2" sx={{ color: '#2563eb', mt: 1 }}>
              Supports PDF, TXT, MD, CSV, DOCX, and more
            </Typography>
          </Box>
        )}

        {/* Header */}
        <Box sx={{ 
          p: 2, 
          borderBottom: '1px solid #f0f2f5',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: '#ffffff'
        }}>
          {/* Document library title and actions */}
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1f2937', fontSize: '14px' }}>
                Documents ({files.length})
              </Typography>
              {files.length > 0 && selectable && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onSelectAll}
                  sx={{
                    fontSize: '11px',
                    py: 0.3,
                    px: 1,
                    borderColor: '#e5e7eb',
                    color: '#6b7280',
                    minWidth: 'auto',
                    height: '24px',
                    '&:hover': {
                      borderColor: '#d1d5db',
                      bgcolor: '#f9fafb'
                    }
                  }}
                >
                  {selectedFiles.length === files.length ? 'Deselect all' : 'Select all'}
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<CloudUploadIcon sx={{ fontSize: 16 }} />}
                onClick={handleUploadClick}
                sx={{ 
                  fontSize: '12px', 
                  py: 0.5, 
                  px: 1.5,
                  borderRadius: 1.5,
                  bgcolor: '#2563EB',
                  height: '28px',
                  '&:hover': {
                    bgcolor: '#2563EB'
                  },
                  boxShadow: 'none'
                }}
              >
                Upload
              </Button>
              
              <VisuallyHiddenInput 
                ref={inputRef}
                type="file" 
                multiple 
                onChange={handleChange} 
              />
              <VisuallyHiddenInput 
                ref={folderInputRef}
                type="file" 
                multiple
                onChange={handleFolderChange} 
              />
            <IconButton
              size="small"
              onClick={onRefreshFiles}
              disabled={isRefreshing}
              sx={{ 
                color: '#6b7280',
                bgcolor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 1.5,
                width: 28,
                height: 28,
                '&:hover': { 
                  bgcolor: '#f3f4f6',
                  color: '#374151'
                }
              }}
            >
              {isRefreshing ? (
                <CircularProgress size={14} />
              ) : (
                <RefreshIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
            </Box>
          </Box>
          
          {/* Upload menu */}
          <Menu
            anchorEl={uploadMenuAnchor}
            open={Boolean(uploadMenuAnchor)}
            onClose={handleUploadMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <MenuItem onClick={handleSelectFiles}>
              <CloudUploadIcon sx={{ mr: 1, fontSize: 16 }} />
              Select files
            </MenuItem>
            <MenuItem onClick={handleSelectFolder}>
              <FolderOpenIcon sx={{ mr: 1, fontSize: 16 }} />
              Select folder
            </MenuItem>
            <MenuItem onClick={handleOpenPublicFiles}>
              <PublicIcon sx={{ mr: 1, fontSize: 16 }} />
              Import from public files
            </MenuItem>
          </Menu>
        </Box>

        {/* File list */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, minHeight: 0 }}>
          {files.length === 0 ? (
            <Box sx={{ 
              p: 3, 
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '150px'
            }}>
              <Typography variant="body2" color="#9ca3af" sx={{ fontSize: '12px' }}>
                No files uploaded yet
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              {files.map((file, index) => (
                <Box
                  key={index}
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    p: 1.2,
                    bgcolor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 1.5,
                    cursor: 'default',  // Different regions have different click behavior
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: '#f8fafc',
                      borderColor: '#d1d5db'
                    }
                  }}
                >
                  {selectable && (
                    <Checkbox
                      checked={selectedFiles.includes(file.filepath)}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(file.filepath);
                      }}
                      sx={{ 
                        mr: 1.5,
                        color: '#d1d5db',
                        padding: '2px',
                        '&.Mui-checked': {
                          color: '#4f46e5'
                        },
                        '& .MuiSvgIcon-root': {
                          fontSize: 18
                        }
                      }}
                    />
                  )}
                  <Box sx={{ minWidth: 24, mr: 1.5 }}>
                    {React.cloneElement(getFileIcon(file.filename), { sx: { fontSize: 20 } })}
                  </Box>
                  <Box 
                    sx={{ 
                      flex: 1, 
                      minWidth: 0,
                      cursor: 'pointer'  // Filename opens the file for reading
                    }}
                    onClick={() => handleFileRead(file.filepath)}
                  >
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 500,
                        color: '#1f2937',
                        fontSize: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                        '&:hover': {
                          color: '#2563eb'  // Hint that the filename is clickable
                        }
                      }}
                    >
                      {file.filename}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: '#9ca3af',
                        fontSize: '10px',
                        lineHeight: 1.2
                      }}
                    >
                      {formatFileSize(file.size)}
                    </Typography>
                  </Box>
                  <IconButton 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile && onDeleteFile(file.filepath);
                    }}
                    sx={{ 
                      color: 'grey',
                      ml: 1,
                      width: 24,
                      height: 24,
                      '&:hover': { 
                        bgcolor: alpha('#ef4444', 0.1)
                      }
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Drop hint */}
        <Box sx={{ 
          p: 1.5, 
          textAlign: 'center'
        }}>
          <Typography 
            variant="caption" 
            sx={{ 
              color: '#9ca3af',
              fontSize: '11px',
              fontStyle: 'italic'
            }}
          >
            Drag files here to upload
          </Typography>
        </Box>
      </Paper>

      {/* Public files import dialog */}
      <PublicFilesDialog
        open={publicFilesDialogOpen}
        onClose={() => setPublicFilesDialogOpen(false)}
        onImport={handleImportPublicFiles}
      />
    </Box>
  );
};

export default FileLibraryWithUpload; 