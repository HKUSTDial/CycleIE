import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ErrorIcon from '@mui/icons-material/Error';
import axios from 'axios';

interface FileContentViewerProps {
  filepath: string;
  projectId?: string;
}

interface FileContent {
  content: string;
  filename: string;
  file_type: string;
  error?: string;
}

const FileContentViewer: React.FC<FileContentViewerProps> = ({ filepath, projectId = 'test-project' }) => {
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch file content
  const fetchFileContent = async (filePath: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/projects/${projectId}/files/content`, {
        params: { filepath: filePath }
      });
      
      setFileContent({
        content: response.data.content,
        filename: response.data.filename,
        file_type: response.data.file_type
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to read the file';
      setError(errorMessage);
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch file content when the file path changes
  useEffect(() => {
    if (filepath) {
      fetchFileContent(filepath);
    } else {
      setFileContent(null);
      setError(null);
    }
  }, [filepath]);

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

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
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
    );
  }

  if (!fileContent) {
    return (
      <Box sx={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 3
      }}>
        <Typography variant="body2" color="text.secondary">
          No file content
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100%',
      overflow: 'auto',
      p: 2,
      bgcolor: '#fafafa',
      borderRadius: 1,
      border: '1px solid #e0e0e0'
    }}>
      {formatContent(fileContent.content, fileContent.file_type)}
    </Box>
  );
};

export default FileContentViewer; 