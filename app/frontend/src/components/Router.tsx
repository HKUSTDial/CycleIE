import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import HomePage from './HomePage';
import App from '../App';

interface ProjectTab {
  id: string;
  projectId: string;
  projectName: string;
  isHome?: boolean;
}

const Router: React.FC = () => {
  const [tabs, setTabs] = useState<ProjectTab[]>([
    { id: 'home', projectId: 'home', projectName: 'Home', isHome: true }
  ]);
  const [activeTabId, setActiveTabId] = useState('home');
  const [previousTabId, setPreviousTabId] = useState('home');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSelectProject = (projectId: string, projectName: string) => {
    const tabId = `project-${projectId}`;
    
    const existingTab = tabs.find(tab => tab.id === tabId);
    
    if (existingTab) {
      setPreviousTabId(activeTabId);
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveTabId(tabId);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 150);
    } else {
      const newTab: ProjectTab = {
        id: tabId,
        projectId,
        projectName,
        isHome: false
      };
      setTabs(prev => [...prev, newTab]);
      setPreviousTabId(activeTabId);
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveTabId(tabId);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 150);
    }
  };

  const handleGoHome = () => {
    setPreviousTabId(activeTabId);
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTabId('home');
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabId === 'home') return;
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    if (activeTabId === tabId) {
      setPreviousTabId(activeTabId);
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveTabId('home');
        setTimeout(() => setIsTransitioning(false), 50);
      }, 150);
    }
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const isHomePage = activeTab?.isHome;
  const isComingFromHome = previousTabId === 'home' && !isHomePage;
  const isGoingToHome = activeTabId === 'home' && !tabs.find(tab => tab.id === previousTabId)?.isHome;

  return (
    <Box sx={{ 
      height: '100vh', 
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Page container */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          transform: isTransitioning 
            ? isComingFromHome 
              ? 'translateX(-30px)' 
              : isGoingToHome 
                ? 'translateX(30px)' 
                : 'translateX(-15px)'
            : 'translateX(0)',
          opacity: isTransitioning ? 0.3 : 1,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: isTransitioning ? 'blur(2px)' : 'blur(0px)',
        }}
      >
        {isHomePage ? (
          <HomePage onSelectProject={handleSelectProject} />
        ) : (
          <App 
            projectId={activeTab?.projectId}
            projectName={activeTab?.projectName}
            onGoHome={handleGoHome}
          />
        )}
      </Box>
      
      {/* Overlay used as a visual buffer during transitions */}
      {isTransitioning && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: isTransitioning ? 1 : 0,
            transition: 'opacity 0.15s ease-in-out'
          }}
        />
      )}
    </Box>
  );
};

export default Router;