import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText as MuiListItemText,
  Divider,
  Chip,
  Avatar,
  Toolbar,
  AppBar
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  ChatBubbleOutline as ChatIcon,
  Description as DocumentIcon,
  Search as SearchIcon,
  GetApp as DownloadIcon,
  FileCopy as CopyIcon,
  Archive as ArchiveIcon,
  Share as ShareIcon,
  FolderShared as SharedIcon,
  Person as PersonIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import axios from 'axios';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  last_modified: string;
  last_chat_time?: string;  // Last chat time
  chat_count: number;
  document_count: number;
  owner?: string;
}

interface HomePageProps {
  onSelectProject: (projectId: string, projectName: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'edit' | 'delete'>('create');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default descending (newest first)

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/projects');
      const fetchedProjects = response.data.projects || [];
      setProjects(fetchedProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    setDialogType('create');
    setProjectName('');
    setProjectDescription('');
    setSelectedProject(null);
    setDialogOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setDialogType('edit');
    setProjectName(project.name);
    setProjectDescription(project.description || '');
    setSelectedProject(project);
    setDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleDeleteProject = (project: Project) => {
    setDialogType('delete');
    setSelectedProject(project);
    setDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, project: Project) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedProject(null);
  };

  const handleDialogConfirm = async () => {
    try {
      if (dialogType === 'create') {
        const response = await axios.post('/api/projects', {
          name: projectName,
          description: projectDescription
        });
        setDialogOpen(false);
        // Open the new project immediately after creation
        if (response.data && response.data.project && response.data.project.id) {
          onSelectProject(response.data.project.id, projectName);
        } else {
          // If the response has no ID, refresh the project list
          fetchProjects();
        }
      } else if (dialogType === 'edit' && selectedProject) {
        await axios.put(`/api/projects/${selectedProject.id}`, {
          name: projectName,
          description: projectDescription
        });
        setDialogOpen(false);
        fetchProjects();
      } else if (dialogType === 'delete' && selectedProject) {
        await axios.delete(`/api/projects/${selectedProject.id}`);
        setDialogOpen(false);
        fetchProjects();
      }
    } catch (error) {
      console.error('Operation failed:', error);
    }
  };

  const handleProjectClick = (project: Project) => {
    onSelectProject(project.id, project.name);
  };

  const getProjectInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const filteredAndSortedProjects = projects.filter(project => {
    // Filter by current filter (all, yours, shared)
    let passesFilter = true;
    if (currentFilter === 'yours') {
      passesFilter = project.owner === 'You' || project.owner === 'you';
    } else if (currentFilter === 'shared') {
      passesFilter = project.owner !== 'You' && project.owner !== 'you' && Boolean(project.owner);
    }
    
    // Filter by search text - if searchText is empty, show all projects
    const passesSearch = searchText.trim() === '' || 
      project.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchText.toLowerCase()));
    
    // Debug logging
    if (searchText.trim() !== '') {
    }
    
    return passesFilter && passesSearch;
  }).sort((a, b) => {
    // Client-side sorting by last chat time
    const aTime = a.last_chat_time;
    const bTime = b.last_chat_time;
    
    // Projects with no chat time go to the end
    if (!aTime && !bTime) {
      return 0;
    }
    if (!aTime) {
      return 1;
    }
    if (!bTime) {
      return -1;
    }
    
    // Sort by time
    const comparison = new Date(aTime).getTime() - new Date(bTime).getTime();
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSelectProject = (projectId: string) => {
    if (selectedProjects.includes(projectId)) {
      setSelectedProjects(selectedProjects.filter(id => id !== projectId));
    } else {
      setSelectedProjects([...selectedProjects, projectId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedProjects.length === filteredAndSortedProjects.length) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(filteredAndSortedProjects.map((p: Project) => p.id));
    }
  };

  const handleSortToggle = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const formatLastChat = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return '1 day ago';
    } else if (diffInDays < 30) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#ffffff' }}>
      {/* Left Sidebar */}
      <Box sx={{ 
        width: 240, 
        bgcolor: '#f8fafc', 
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Logo */}
        <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <img 
              src="/logo_1.png" 
              alt="Logo" 
              style={{ width: 180, height: 40, marginRight: 12 }}
            />
          </Box>
        </Box>

        {/* New Project Button */}
        <Box sx={{ p: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateProject}
            fullWidth
            sx={{
              bgcolor: '#000000',
              color: 'white',
              fontWeight: 600,
              py: 1.5,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                bgcolor: '#1a1a1a',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              },
              '&:active': {
                transform: 'translateY(0)',
                transition: 'transform 0.1s ease-in-out'
              },
              textTransform: 'none',
              borderRadius: 1
            }}
          >
            New project
          </Button>
        </Box>

        {/* Navigation */}
        <List sx={{ px: 1, flexGrow: 1 }}>
          <ListItem disablePadding>
            <ListItemButton
              selected={currentFilter === 'all'}
              onClick={() => setCurrentFilter('all')}
              sx={{
                borderRadius: 1,
                mx: 1,
                '&.Mui-selected': {
                  bgcolor: '#e2e8f0',
                  '&:hover': {
                    bgcolor: '#cbd5e1'
                  }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <FolderIcon fontSize="small" />
              </ListItemIcon>
              <MuiListItemText 
                primary="All projects" 
                primaryTypographyProps={{ fontSize: '0.875rem', color: '#333333' }}
              />
            </ListItemButton>
          </ListItem>
          
          <ListItem disablePadding>
            <ListItemButton
              selected={currentFilter === 'yours'}
              onClick={() => setCurrentFilter('yours')}
              sx={{
                borderRadius: 1,
                mx: 1,
                '&.Mui-selected': {
                  bgcolor: '#e2e8f0',
                  '&:hover': {
                    bgcolor: '#cbd5e1'
                  }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              <MuiListItemText 
                primary="Your projects" 
                primaryTypographyProps={{ fontSize: '0.875rem', color: '#333333'}}
              />
            </ListItemButton>
          </ListItem>
          
          <ListItem disablePadding>
            <ListItemButton
              selected={currentFilter === 'shared'}
              onClick={() => setCurrentFilter('shared')}
              sx={{
                borderRadius: 1,
                mx: 1,
                '&.Mui-selected': {
                  bgcolor: '#e2e8f0',
                  '&:hover': {
                    bgcolor: '#cbd5e1'
                  }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <SharedIcon fontSize="small" />
              </ListItemIcon>
              <MuiListItemText 
                primary="Shared with you" 
                primaryTypographyProps={{ fontSize: '0.875rem', color: '#333333' }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <AppBar position="static" elevation={0} sx={{ bgcolor: 'white', color: '#0f172a' }}>
          <Toolbar>
            <Typography variant="h5" sx={{ 
              flexGrow: 1, 
              fontWeight: 600,
              color: '#0f172a'
            }}>
              {currentFilter === 'all' && 'All projects'}
              {currentFilter === 'yours' && 'Your projects'}
              {currentFilter === 'shared' && 'Shared with you'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mr: 1 }}>
              {/* You're using */}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
              {/* CycleIE Premium */}
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Search Bar */}
        <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0' }}>
          <TextField
            fullWidth
            placeholder="Search in all projects..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#64748b' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#f8fafc',
                borderRadius: 1,
                '& fieldset': {
                  borderColor: '#e2e8f0',
                },
                '&:hover fieldset': {
                  borderColor: '#cbd5e1',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#2563eb',
                },
              },
            }}
          />
        </Box>

        {/* Projects Table */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedProjects.length > 0 && selectedProjects.length < filteredAndSortedProjects.length}
                      checked={filteredAndSortedProjects.length > 0 && selectedProjects.length === filteredAndSortedProjects.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Owner</TableCell>
                  <TableCell 
                    sx={{ 
                      fontWeight: 600, 
                      color: '#374151',
                      cursor: 'pointer',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                    onClick={handleSortToggle}
                  >
                    Last Chat
                    <IconButton size="small" sx={{ color: '#374151' }}>
                      {sortOrder === 'desc' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 8 }}>
                      <Typography sx={{ color: '#64748b' }}>Loading...</Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 8 }}>
                      <FolderIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
                      <Typography variant="h6" sx={{ color: '#374151', mb: 1 }}>
                        No projects found
                      </Typography>
                      <Typography sx={{ color: '#64748b' }}>
                        Create your first project to get started
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedProjects.map((project: Project) => (
                    <TableRow
                      key={project.id}
                      hover
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          bgcolor: '#f8fafc',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                          '& .project-icon': {
                            color: '#2563eb',
                            transform: 'scale(1.1)'
                          },
                          '& .project-title': {
                            color: '#2563eb'
                          }
                        }
                      }}
                      onClick={() => handleProjectClick(project)}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedProjects.includes(project.id)}
                          onChange={() => handleSelectProject(project.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <DocumentIcon 
                            className="project-icon"
                            sx={{ 
                              mr: 2, 
                              color: '#64748b',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} 
                          />
                          <Box>
                            <Typography 
                              variant="body2" 
                              className="project-title"
                              sx={{ 
                                fontWeight: 500, 
                                color: '#0f172a',
                                transition: 'color 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            >
                              {project.name}
                            </Typography>
                            {project.description && (
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                {project.description}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {project.owner === 'You' ? (
                            <Typography variant="body2" sx={{ color: '#0f172a' }}>
                              You
                            </Typography>
                          ) : (
                            <>
                              <ShareIcon sx={{ fontSize: 16, mr: 1, color: '#64748b' }} />
                              <Typography variant="body2" sx={{ color: '#0f172a' }}>
                                {project.owner || 'Unknown'}
                              </Typography>
                            </>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          {project.last_chat_time ? formatLastChat(project.last_chat_time) : 'No chats yet'}
                          {project.owner && (
                            <>
                              {' by '}
                              <span style={{ color: '#0f172a' }}>{project.owner}</span>
                            </>
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle download
                            }}
                            sx={{ color: '#64748b' }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle copy
                            }}
                            sx={{ color: '#64748b' }}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle archive
                            }}
                            sx={{ color: '#64748b' }}
                          >
                            <ArchiveIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, project)}
                            sx={{ color: '#64748b' }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Context Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => selectedProject && handleEditProject(selectedProject)}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => selectedProject && handleDeleteProject(selectedProject)}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>

        {/* Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {dialogType === 'create' && 'New Project'}
            {dialogType === 'edit' && 'Rename Project'}
            {dialogType === 'delete' && 'Delete Project'}
          </DialogTitle>
          <DialogContent>
            {dialogType === 'delete' ? (
              <Typography>
                Are you sure you want to delete project "{selectedProject?.name}"? This action cannot be undone.
              </Typography>
            ) : (
              <>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Project Name"
                  fullWidth
                  variant="outlined"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <TextField
                  margin="dense"
                  label="Description (optional)"
                  fullWidth
                  multiline
                  rows={3}
                  variant="outlined"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleDialogConfirm}
              variant="contained"
              disabled={dialogType !== 'delete' && !projectName.trim()}
              color={dialogType === 'delete' ? 'error' : 'primary'}
            >
              {dialogType === 'create' && 'Create'}
              {dialogType === 'edit' && 'Save'}
              {dialogType === 'delete' && 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default HomePage;
