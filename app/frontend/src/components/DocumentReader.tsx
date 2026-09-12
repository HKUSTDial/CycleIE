import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import ErrorIcon from '@mui/icons-material/Error';
import Tooltip from '@mui/material/Tooltip';
import axios from 'axios';

interface DocumentReaderProps {
  isCollapsed: boolean;
  onToggle: () => void;
  selectedFile: string | null;
  onClose: () => void;
  projectId?: string;
}

interface FileContent {
  content: string;
  filename: string;
  fileType: string;
  error?: string;
}

const DocumentReader: React.FC<DocumentReaderProps> = ({
  isCollapsed,
  onToggle,
  selectedFile,
  onClose,
  projectId = 'test-project'
}) => {
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch file content
  const fetchFileContent = async (filepath: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/projects/${projectId}/files/content`, {
        params: { filepath }
      });
      
      setFileContent({
        content: response.data.content,
        filename: response.data.filename,
        fileType: response.data.file_type
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to read the file';
      setError(errorMessage);
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch file content when the selected file changes
  useEffect(() => {
    if (selectedFile) {
      fetchFileContent(selectedFile);
    } else {
      setFileContent(null);
      setError(null);
    }
  }, [selectedFile]);

  // File icon
  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    if (extension === 'pdf') {
      return <PictureAsPdfIcon color="error" sx={{ fontSize: 20 }} />;
    } else if (['csv', 'xlsx', 'xls'].includes(extension)) {
      return <TableChartIcon color="success" sx={{ fontSize: 20 }} />;
    } else {
      return <DescriptionIcon color="primary" sx={{ fontSize: 20 }} />;
    }
  };

  // Format file content
  const formatContent = (content: string, fileType: string) => {
    if (fileType === 'csv') {
      // Simple CSV table
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) return content;
      
      const headers = lines[0].split(',');
      const rows = lines.slice(1).map(line => line.split(','));
      
      return (
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '12px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                {headers.map((header, index) => (
                  <th key={index} style={{ 
                    border: '1px solid #e2e8f0',
                    padding: '8px',
                    textAlign: 'left',
                    fontWeight: 600
                  }}>
                    {header.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} style={{ 
                      border: '1px solid #e2e8f0',
                      padding: '8px'
                    }}>
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 100 && (
            <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary', fontStyle: 'italic' }}>
              Showing the first 100 rows only
            </Typography>
          )}
        </Box>
      );
    }
    
    // Render other file types as plain text
    return (
      <Typography
        component="pre"
        sx={{
          fontSize: '12px',
          lineHeight: 1.6,
          color: '#374151',
          fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: 0
        }}
      >
        {content}
      </Typography>
    );
  };

  return (
    <Box sx={{ 
      width: isCollapsed ? '60px' : '400px',
      transition: 'width 0.3s ease-in-out',
      backgroundColor: '#f8fafc',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: isCollapsed ? 'none' : '-2px 0 8px rgba(0,0,0,0.1)',
      zIndex: 10
    }}>
      {isCollapsed ? (
        // Collapsed: show only the expand button, nothing selected
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
          pt: 2
        }}>
          <Tooltip title="File reader" placement="left">
            <IconButton 
              onClick={onToggle}
              sx={{ 
                bgcolor: 'grey.300',
                color: 'grey.600',
                height: '30px',
                width: '30px',
                mb: 2,
                '&:hover': { 
                  bgcolor: 'grey.400'
                }
              }}
            >
              <DescriptionIcon sx={{ fontSize: '15px' }} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        // Expanded: show the full file reader
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            p: 2,
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#ffffff'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '14px' }}>
                File reader
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {selectedFile && (
                <Tooltip title="Close file" placement="bottom">
                  <IconButton 
                    onClick={onClose}
                    size="small"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { 
                        bgcolor: 'action.hover' 
                      }
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="" placement="bottom">
                <IconButton 
                  onClick={onToggle}
                  size="small"
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { 
                      bgcolor: 'action.hover' 
                    }
                  }}
                >
                  <ChevronRightIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          {/* File content area */}
          <Box sx={{ 
            flexGrow: 1, 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {!selectedFile ? (
              // Prompt when no file is selected
              <Box sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                p: 3,
                textAlign: 'center'
              }}>
                <DescriptionIcon sx={{ 
                  fontSize: 60, 
                  color: 'text.disabled',
                  mb: 2 
                }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '14px' }}>
                  Click a file in the library on the left
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '14px' }}>
                  to view its contents
                </Typography>
              </Box>
            ) : loading ? (
              // Loading state
              <Box sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 2
              }}>
                <CircularProgress size={40} />
                <Typography variant="body2" color="text.secondary">
                  Loading file contents...
                </Typography>
              </Box>
            ) : error ? (
              // Error state
              <Box sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                p: 3,
                textAlign: 'center'
              }}>
                <ErrorIcon sx={{ 
                  fontSize: 60, 
                  color: 'error.main',
                  mb: 2 
                }} />
                <Typography variant="body2" color="error" sx={{ fontSize: '14px' }}>
                  {error}
                </Typography>
              </Box>
            ) : fileContent ? (
              // Show file content
              <Box sx={{ 
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden'
              }}>
                {/* File info */}
                <Box sx={{ 
                  p: 2, 
                  borderBottom: '1px solid #e2e8f0',
                  bgcolor: '#ffffff'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* {getFileIcon(fileContent.filename)} */}
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 500,
                        fontSize: '12px',
                        color: 'text.primary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}
                    >
                      {fileContent.filename}
                    </Typography>
                  </Box>
                </Box>
                
                {/* File content */}
                <Box sx={{ 
                  flexGrow: 1, 
                  overflowY: 'auto',
                  p: 2,
                  bgcolor: '#ffffff'
                }}>
                  {formatContent(fileContent.content, fileContent.fileType)}
                </Box>
              </Box>
            ) : null}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DocumentReader; 