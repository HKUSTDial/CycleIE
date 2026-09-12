import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon
} from '@mui/icons-material';
import '../styles/ChatHistoryPanel.css';

interface ChatHistory {
  id: string;
  title: string;
  message_count: number;
  updated_at: string;
}

interface ChatHistoryPanelProps {
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  currentChatId: string | null;
  refreshTrigger?: number;
  projectId?: string;
}

const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  onSelectChat,
  onNewChat,
  currentChatId,
  refreshTrigger = 0,
  projectId = 'test-project'
}) => {
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [isSelectingChat, setIsSelectingChat] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<boolean>(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Fetch the chat history list
  const fetchChatHistory = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}/chat/history`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load chat history');
      }
      
      const data = await response.json();
      setChatHistory(data);
      setError(null);
    } catch (err) {
      console.error('Error loading chat history:', err);
      setError('Failed to load chat history. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Load chat history on mount
  useEffect(() => {
    fetchChatHistory();
  }, []);

  // Refresh history when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0 && !loading) {
      setShowAll(false); // Reset the display state
      fetchChatHistory();
    }
  }, [refreshTrigger]);

  // Focus the input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [isRenaming]);

  // Start a new chat
  const handleNewChatClick = () => {
    onNewChat();
  };

  // Select a chat
  const handleSelectChat = (chatId: string) => {
    if (isRenaming !== chatId) {
      setIsSelectingChat(chatId);
      onSelectChat(chatId);
      handleCloseMenu();
      
      // Reset selection state after 500ms
      setTimeout(() => {
        setIsSelectingChat(null);
      }, 500);
    }
  };

  // Open the menu
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, chatId: string) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedChatId(chatId);
  };

  // Close the menu
  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedChatId(null);
  };

  // Start renaming
  const handleRename = () => {
    if (selectedChatId) {
      const chat = chatHistory.find(c => c.id === selectedChatId);
      if (chat) {
        setIsRenaming(selectedChatId);
        setNewTitle(chat.title);
      }
    }
    handleCloseMenu();
  };

  // Submit the rename
  const handleRenameSubmit = async (chatId: string) => {
    if (!newTitle.trim()) {
      setIsRenaming(null);
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}/chat/rename/${chatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ title: newTitle.trim() })
      });

      if (!response.ok) {
        throw new Error('Rename failed');
      }

      // Update local state
      setChatHistory(prev => 
        prev.map(chat => 
          chat.id === chatId 
            ? { ...chat, title: newTitle.trim() }
            : chat
        )
      );
      
      setIsRenaming(null);
      setNewTitle('');
    } catch (err) {
      console.error('Error renaming chat:', err);
      alert('Rename failed. Please try again later.');
    }
  };

  // Rename keyboard shortcuts
  const handleRenameKeyDown = (e: React.KeyboardEvent, chatId: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(chatId);
    } else if (e.key === 'Escape') {
      setIsRenaming(null);
      setNewTitle('');
    }
  };

  // Confirm deletion
  const handleDeleteConfirm = () => {
    if (selectedChatId) {
      setChatToDelete(selectedChatId);
      setDeleteDialogOpen(true);
    }
    handleCloseMenu();
  };

  // Delete the chat
  const handleDelete = async () => {
    if (!chatToDelete) return;

    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}/chat/delete/${chatToDelete}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      // Remove from local state
      setChatHistory(prev => prev.filter(chat => chat.id !== chatToDelete));
      
      // If the current chat was deleted, start a new one
      if (chatToDelete === currentChatId) {
        onNewChat();
      }
      
      setDeleteDialogOpen(false);
      setChatToDelete(null);
    } catch (err) {
      console.error('Error deleting chat:', err);
      alert('Delete failed. Please try again later.');
    }
  };

  // Format a date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) {
        return 'Today';
      } else if (diffInDays === 1) {
        return 'Yesterday';
      } else if (diffInDays === 2) {
        return '2 days ago';
      } else {
        return 'Earlier';
      }
    } catch (e) {
      return '';
    }
  };

  // Show all chats
  const handleShowAll = () => {
    setShowAll(true);
  };

  // Pagination
  const INITIAL_DISPLAY_COUNT = 20;
  const displayedChats = showAll ? chatHistory : chatHistory.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMoreChats = !showAll && chatHistory.length > INITIAL_DISPLAY_COUNT;

  // Group chats by date
  const groupChatsByDate = (chats: ChatHistory[]) => {
    const groups: { [key: string]: ChatHistory[] } = {};
    
    chats.forEach(chat => {
      const dateKey = formatDate(chat.updated_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(chat);
    });
    
    return groups;
  };

  const chatGroups = groupChatsByDate(displayedChats);

  return (
    <div className="chat-history-panel-content">
      {/* New chat button */}
      <div className="chat-history-actions">
        <button 
          className="new-chat-button"
          onClick={handleNewChatClick}
          title="New chat"
          style={{ backgroundColor: '#000000', color: '#ffffff', fontSize: '12px' }}
        >
          <AddIcon style={{ fontSize: 12 }} />
          New chat
        </button>
      </div>

      {/* Chat list */}
      <div className="chat-history-list">
        {loading ? (
          <div className="history-loading">
            <CircularProgress size={16} />
            Loading...
          </div>
        ) : error ? (
          <div className="history-error">
            {error}
            <Button 
              onClick={fetchChatHistory} 
              size="small" 
              sx={{ mt: 1, display: 'block', margin: '8px auto 0' }}
            >
              Retry
            </Button>
          </div>
        ) : chatHistory.length === 0 ? (
          <div className="empty-history-message">
            <ChatBubbleOutlineIcon className="empty-state-icon" />
            <div className="empty-message-text">
              <div>No chats yet</div>
              <div>Click the button above to start a new conversation</div>
            </div>
          </div>
        ) : (
          Object.entries(chatGroups).map(([dateLabel, chats]) => (
            <div key={dateLabel}>
              {/* Date group heading */}
              <div className="date-group">
                <div className="date-group-title">{dateLabel}</div>
              </div>
              
              {/* Chats in this date group */}
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`chat-history-item ${chat.id === currentChatId ? 'active' : ''} ${isSelectingChat === chat.id ? 'selecting' : ''}`}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="chat-history-item-content">
                    {isRenaming === chat.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        className="rename-input"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, chat.id)}
                        onBlur={() => handleRenameSubmit(chat.id)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Enter a new title..."
                      />
                    ) : (
                      <div className="chat-history-item-title">
                        {chat.title}
                      </div>
                    )}
                  </div>
                  {!isRenaming && (
                    <div className="chat-history-item-options">
                      <button
                        className="options-button"
                        onClick={(e) => handleMenuClick(e, chat.id)}
                        title="More options"
                      >
                        <MoreVertIcon style={{ fontSize: 16 }} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}

        {/* Show more button */}
        {hasMoreChats && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginTop: '16px', 
            padding: '8px 16px' 
          }}>
<button 
  onClick={handleShowAll}
  style={{
    backgroundColor: 'transparent',
    color: '#666',
    padding: '8px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    border: 'none',
    borderRadius: '30px',
    width: '100%',
  }}
  onMouseOver={(e) => {
    e.currentTarget.style.backgroundColor = '#e0ecff'; // Dark blue
    e.currentTarget.style.color = '#fff'; // White text for readability
  }}
  onMouseDown={(e) => {
    e.currentTarget.style.backgroundColor = '#c9dcfb'; // Darker blue (while pressed)
  }}
  onMouseUp={(e) => {
    e.currentTarget.style.backgroundColor = '#1e3a8a'; // Back to the hover color
  }}
  onMouseOut={(e) => {
    e.currentTarget.style.backgroundColor = 'transparent';
    e.currentTarget.style.color = '#666';
  }}
>
  Show more
</button>
          </div>
        )}
      </div>

      {/* Context menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          className: 'options-menu',
          sx: {
            mt: 1,
            borderRadius: '6px',
            minWidth: 120,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }
        }}
      >
        <MenuItem 
          onClick={handleRename}
          sx={{ 
            fontSize: '14px',
            py: '8px',
            px: '16px',
            minHeight: 'auto',
            color: '#262626'
          }}
        >
          <EditIcon style={{ fontSize: 16, marginRight: 8, color: '#8c8c8c' }} />
          Rename
        </MenuItem>
        <MenuItem 
          onClick={handleDeleteConfirm} 
          className="delete-option"
          sx={{ 
            color: '#ff4d4f',
            fontSize: '14px',
            py: '8px',
            px: '16px',
            minHeight: 'auto'
          }}
        >
          <DeleteIcon style={{ fontSize: 16, marginRight: 8 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        className="delete-dialog"
        PaperProps={{
          sx: {
            borderRadius: '8px',
            minWidth: 320
          }
        }}
      >
        <DialogTitle 
          id="delete-dialog-title"
          sx={{ 
            fontSize: '16px',
            fontWeight: 500,
            color: '#262626',
            padding: '20px 24px 8px'
          }}
        >
          Confirm delete
        </DialogTitle>
        <DialogContent sx={{ padding: '8px 24px 20px' }}>
          <DialogContentText sx={{ 
            fontSize: '14px', 
            color: '#595959',
            margin: 0
          }}>
            Are you sure you want to delete this chat? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ padding: '12px 16px 16px', gap: '8px' }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ 
              textTransform: 'none',
              fontWeight: 400,
              minWidth: 64,
              height: 32,
              padding: '4px 15px',
              fontSize: '14px',
              borderRadius: '6px',
              color: '#595959'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="contained"
            sx={{ 
              textTransform: 'none',
              fontWeight: 400,
              minWidth: 64,
              height: 32,
              padding: '4px 15px',
              fontSize: '14px',
              borderRadius: '6px',
              backgroundColor: '#ff4d4f',
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#ff7875',
                boxShadow: 'none'
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ChatHistoryPanel; 