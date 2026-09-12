import React, { useState, useEffect } from 'react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import TableChartIcon from '@mui/icons-material/TableChart';
import Link from '@mui/icons-material/Link';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TripletGraphViewer from './TripletGraphViewer';
import TreeViewer from './TreeViewer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface LargeContentViewerProps {
  content: string;
  contentType: 'table' | 'graph' | 'tree' | 'text';
  preview: string;
}

const LargeContentViewer: React.FC<LargeContentViewerProps> = ({
  content,
  contentType,
  preview
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Check whether the content should be expandable
  useEffect(() => {
    const contentLength = content.length;
    const lineCount = content.split('\n').length;
    
    // Decide whether to offer expand based on content type
    if (contentType === 'table' && lineCount > 10) {
      setHasOverflow(true);
    } else if (contentType === 'graph' && contentLength > 1000) {
      setHasOverflow(true);
    } else if (contentType === 'tree' && (lineCount > 15 || contentLength > 1500)) {
      setHasOverflow(true);
    } else if (contentType === 'text' && contentLength > 2000) {
      setHasOverflow(true);
    }
  }, [content, contentType]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Close the modal on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isModalOpen) {
        handleCloseModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

  const getContentIcon = () => {
    switch (contentType) {
      case 'table':
        return <TableChartIcon />;
      case 'graph':
        return <Link />;
      case 'tree':
        return <AccountTreeIcon />;
      default:
        return <FullscreenIcon />;
    }
  };

  const getContentTypeLabel = () => {
    switch (contentType) {
      case 'table':
        return 'Long Table';
      case 'graph':
        return 'Graph';
      case 'tree':
        return 'Tree Structure';
      default:
        return 'Large Content';
    }
  };

  const renderPreviewContent = () => {
    if (contentType === 'graph') {
      return (
        <pre style={{ 
          fontFamily: 'monospace', 
          fontSize: '12px', 
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          margin: 0
        }}>
          {preview}
        </pre>
      );
    }
    
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p style={{ margin: '4px 0' }}>{children}</p>,
          table: ({ children }) => (
            <table style={{ fontSize: '12px', borderCollapse: 'collapse' }}>
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th style={{ border: '1px solid #ddd', padding: '4px', fontSize: '11px' }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ border: '1px solid #ddd', padding: '4px', fontSize: '11px' }}>
              {children}
            </td>
          )
        }}
      >
        {preview}
      </ReactMarkdown>
    );
  };

  const renderModalContent = () => {
    if (contentType === 'graph') {
      return <TripletGraphViewer content={content} />;
    }
    
    if (contentType === 'tree') {
      return <TreeViewer content={content} />;
    }
    
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ children }) => (
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th style={{ 
              border: '1px solid #ddd', 
              padding: '8px',
              backgroundColor: '#f5f5f5',
              textAlign: 'left'
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ 
              border: '1px solid #ddd', 
              padding: '8px'
            }}>
              {children}
            </td>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <>
      <Paper 
        elevation={2}
        sx={{
          p: 2,
          mb: 2,
          border: '1px solid #e0e0e0',
          borderRadius: 2,
          position: 'relative',
          maxHeight: '300px',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          mb: 1 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getContentIcon()}
            <Typography variant="subtitle2" color="primary">
              {getContentTypeLabel()}
            </Typography>
          </Box>
          
          <IconButton
            size="small"
            onClick={handleOpenModal}
            sx={{ 
              color: 'primary.main',
              backgroundColor: 'rgba(25, 118, 210, 0.08)',
              borderRadius: '8px',
              padding: '6px',
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.12)',
                transform: 'scale(1.05)',
                transition: 'all 0.2s ease-in-out'
              },
              '&:active': {
                transform: 'scale(0.98)'
              }
            }}
          >
            <FullscreenIcon fontSize="small" />
          </IconButton>
        </Box>
        
        <Box sx={{ 
          maxHeight: '200px', 
          overflow: 'hidden',
          position: 'relative'
        }}>
          {renderPreviewContent()}
          
          {hasOverflow && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '40px',
                background: 'linear-gradient(transparent, white)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                pb: 1
              }}
            >
            </Box>
          )}
        </Box>
      </Paper>

      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        closeAfterTransition
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2
        }}
      >
        <Paper
          sx={{
            width: contentType === 'graph' ? 'auto' : '95vw',
            height: contentType === 'graph' ? 'auto' : '95vh',
            maxWidth: '1400px',
            maxHeight: contentType === 'graph' ? '95vh' : '1000px',
            p: 3,
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: '1px solid #e0e0e0',
            pb: 2,
            mb: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getContentIcon()}
              <Typography variant="h6">
                {getContentTypeLabel()} details
              </Typography>
            </Box>
            
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Box sx={{ 
            flex: contentType === 'graph' ? 'none' : 1,
            overflow: contentType === 'graph' ? 'visible' : 'auto',
            maxHeight: contentType === 'graph' ? 'none' : '90vh',
            ...(contentType !== 'graph' && {
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#c1c1c1',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: '#a8a8a8',
              }
            })
          }}>
            {renderModalContent()}
          </Box>
        </Paper>
      </Modal>
    </>
  );
};

export default LargeContentViewer; 