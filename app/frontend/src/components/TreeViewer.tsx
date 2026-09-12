import React, { useState, useMemo, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CircleIcon from '@mui/icons-material/Circle';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  level: number;
  isLeaf: boolean;
  type?: 'person' | 'relation' | 'detail' | 'general';
  metadata?: { [key: string]: string };
}

interface TreeViewerProps {
  content: string;
}

const TreeViewer: React.FC<TreeViewerProps> = ({ content }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Parse triplet-format tree data
  const parseTripletFormat = (text: string): TreeNode[] => {
    
    // Handle quoted key-value formats first

    const complexPattern = /\(([^,)]+),\s*([^,)]+),\s*([^,)]+)(?:,\s*([^)]+))?\)/g;
    
    const triplets: { 
      parent: string; 
      relation: string; 
      child: string;
      metadata?: { [key: string]: string };
    }[] = [];
    
    // Clean the text, strip list markers, and handle single-line input
    let cleanedText = text.replace(/^-\s*/gm, '').replace(/^\s*\*\s*/gm, '');
    
    // If the data is on one line, split it so it can be parsed more reliably
    if (cleanedText.includes('<Tree START>') && cleanedText.includes('<Tree END>')) {
      const startMarker = '<Tree START>';
      const endMarker = '<Tree END>';
      const startIndex = cleanedText.indexOf(startMarker);
      const endIndex = cleanedText.indexOf(endMarker);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const beforeMarker = cleanedText.substring(0, startIndex);
        const afterMarker = cleanedText.substring(endIndex + endMarker.length);
        const treeContent = cleanedText.substring(startIndex + startMarker.length, endIndex).trim();
        
        // Split a single-line triplet list into lines
        const tripletMatches = treeContent.match(/\([^)]+\)/g);
        if (tripletMatches) {
          const formattedTriplets = tripletMatches.join('\n');
          cleanedText = beforeMarker + startMarker + '\n' + formattedTriplets + '\n' + endMarker + afterMarker;
        }
      }
    }
    
    let match;
    while ((match = complexPattern.exec(cleanedText)) !== null) {
      const parent = match[1].trim().replace(/^"/, '').replace(/"$/, '');
      const relation = match[2].trim();
      const child = match[3].trim().replace(/^"/, '').replace(/"$/, '');
      
      // Parse extra key-value metadata
      const metadata: { [key: string]: string } = {};
      if (match[4]) {
        const extraInfo = match[4];
        // Parse key-value pairs: "key": "value"
        const keyValuePattern = /"([^"]+)":\s*"([^"]+)"/g;
        let kvMatch;
        while ((kvMatch = keyValuePattern.exec(extraInfo)) !== null) {
          metadata[kvMatch[1]] = kvMatch[2];
        }
      }
      
      triplets.push({ parent, relation, child, metadata });
    }
    
    if (triplets.length === 0) {
      return [];
    }
    
    
    // Build the node map
    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];
    
    // Create primary entity nodes first
    const allEntities = new Set<string>();
    triplets.forEach(triplet => {
      allEntities.add(triplet.parent);
      allEntities.add(triplet.child);
    });
    
    allEntities.forEach(entityName => {
      if (!nodeMap.has(entityName)) {
        nodeMap.set(entityName, {
          id: entityName,
          label: entityName,
          level: 0,
          isLeaf: true,
          children: [],
          type: 'person',
          metadata: {}
        });
      }
    });
    
    // Build the relationship structure
    triplets.forEach((triplet, index) => {
      const parentNode = nodeMap.get(triplet.parent);
      
      if (parentNode) {
        // Create a relationship node with a friendlier label
        const relationId = `${triplet.parent}_${triplet.relation}_${index}`;
        const relationLabel = `${triplet.relation.replace(/_/g, ' ')} → ${triplet.child}`;
        
        const relationNode: TreeNode = {
          id: relationId,
          label: relationLabel,
          level: 0,
          isLeaf: true,
          children: [],
          type: 'relation',
          metadata: triplet.metadata || {}
        };
        
        // If there is extra metadata, add detail child nodes
        if (triplet.metadata && Object.keys(triplet.metadata).length > 0) {
          Object.entries(triplet.metadata).forEach(([key, value], metaIndex) => {
            const detailNode: TreeNode = {
              id: `${relationId}_detail_${metaIndex}`,
              label: `${key}: ${value}`,
              level: 0,
              isLeaf: true,
              type: 'detail',
              metadata: {}
            };
            relationNode.children!.push(detailNode);
          });
          relationNode.isLeaf = false;
        }
        
        // Attach the relationship node to its parent
        if (!parentNode.children) {
          parentNode.children = [];
        }
        parentNode.children.push(relationNode);
        parentNode.isLeaf = false;
      }
    });
    
    // Find root nodes (parents in triplets that never appear as children)
    const childEntities = new Set<string>();
    triplets.forEach(triplet => {
      childEntities.add(triplet.child);
    });
    
    nodeMap.forEach((node, nodeName) => {
      if (!childEntities.has(nodeName) && node.children && node.children.length > 0) {
        rootNodes.push(node);
      }
    });
    
    // If there is no clear root, use the node with the most relationships
    if (rootNodes.length === 0) {
      const nodeRelationCount = new Map<string, number>();
      triplets.forEach(triplet => {
        nodeRelationCount.set(triplet.parent, (nodeRelationCount.get(triplet.parent) || 0) + 1);
      });
      
      let maxRelations = 0;
      let topNode: TreeNode | null = null;
      nodeRelationCount.forEach((count, nodeName) => {
        if (count > maxRelations) {
          maxRelations = count;
          topNode = nodeMap.get(nodeName) || null;
        }
      });
      
      if (topNode) {
        rootNodes.push(topNode);
      }
    }
    
    // If there is still no root, treat every node that has children as a root
    if (rootNodes.length === 0) {
      nodeMap.forEach(node => {
        if (node.children && node.children.length > 0) {
          rootNodes.push(node);
        }
      });
    }
    
    // Compute depth
    const calculateLevels = (nodes: TreeNode[], level: number) => {
      nodes.forEach(node => {
        node.level = level;
        if (node.children && node.children.length > 0) {
          calculateLevels(node.children, level + 1);
        }
      });
    };
    
    calculateLevels(rootNodes, 0);
    
    
    return rootNodes;
  };
  
  // Parse tree data
  const parseTreeData = (text: string): TreeNode[] => {
    // Try the triplet format first (the current standard)
    const tripletResult = parseTripletFormat(text);
    if (tripletResult.length > 0) {
      return tripletResult;
    }
    
    try {
      // Try JSON (backward compatible)
      const jsonData = JSON.parse(text);
      
      // Array form
      if (Array.isArray(jsonData)) {
        return jsonData.map((item, index) => parseJsonNode(item, `root-${index}`, 0));
      }
      
      // Object form
      if (typeof jsonData === 'object' && jsonData !== null) {
        return [parseJsonNode(jsonData, 'root', 0)];
      }
      
      return [];
    } catch (error) {
      
      // Try indented text
      return parseIndentedText(text);
    }
  };
  
  // Parse a JSON node
  const parseJsonNode = (node: any, id: string, level: number): TreeNode => {
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      return {
        id,
        label: String(node),
        level,
        isLeaf: true
      };
    }
    
    if (Array.isArray(node)) {
      const children = node.map((item, index) => 
        parseJsonNode(item, `${id}-${index}`, level + 1)
      );
      
      return {
        id,
        label: `Array (${node.length} items)`,
        children,
        level,
        isLeaf: false
      };
    }
    
    if (typeof node === 'object' && node !== null) {
      const children = Object.entries(node).map(([key, value]) => 
        parseJsonNode(value, `${id}-${key}`, level + 1)
      );
      
      // Prefer name or title when present
      const displayName = node.name || node.title || node.label || id;
      
      return {
        id,
        label: String(displayName),
        children: children.length > 0 ? children : undefined,
        level,
        isLeaf: children.length === 0
      };
    }
    
    return {
      id,
      label: String(node),
      level,
      isLeaf: true
    };
  };
  
  // Parse indented text
  const parseIndentedText = (text: string): TreeNode[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const nodes: TreeNode[] = [];
    const stack: { node: TreeNode; indent: number }[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!trimmed) continue;
      
      // Compute indent level
      const indent = line.length - line.trimStart().length;
      
      // Create a node
      const node: TreeNode = {
        id: `node-${i}`,
        label: trimmed.replace(/^[-*+•]\s*/, ''), // strip list markers
        level: Math.floor(indent / 2), // assume 2 spaces per indent level
        isLeaf: true,
        children: []
      };
      
      // Adjust the stack to preserve hierarchy
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        const popped = stack.pop();
        if (popped && popped.node.children && popped.node.children.length > 0) {
          popped.node.isLeaf = false;
        }
      }
      
      if (stack.length === 0) {
        // Root node
        nodes.push(node);
      } else {
        // Child nodes
        const parent = stack[stack.length - 1].node;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
        parent.isLeaf = false;
      }
      
      stack.push({ node, indent });
    }
    
    // Flush the last node
    while (stack.length > 0) {
      const popped = stack.pop();
      if (popped && popped.node.children && popped.node.children.length > 0) {
        popped.node.isLeaf = false;
      }
    }
    
    return nodes;
  };
  
  const treeData = useMemo(() => parseTreeData(content), [content]);
  
  // Expand every node
  useEffect(() => {
    const allNodeIds = new Set<string>();
    const collectNodeIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          allNodeIds.add(node.id);
          collectNodeIds(node.children);
        }
      });
    };
    
    if (treeData.length > 0) {
      collectNodeIds(treeData);
      setExpandedNodes(allNodeIds);
    }
  }, [treeData]);
  
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };
  
  const renderTreeNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <Box key={node.id} sx={{ width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0.5,
            px: 1,
            ml: node.level * 2,
            borderRadius: 1,
            cursor: hasChildren ? 'pointer' : 'default',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
            transition: 'background-color 0.2s ease',
          }}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          {/* Expand/collapse icon */}
          {hasChildren ? (
            <IconButton
              size="small"
              sx={{ 
                p: 0.5, 
                mr: 0.5,
                color: 'text.secondary'
              }}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          ) : (
            <Box sx={{ width: 32, height: 32, mr: 0.5 }} />
          )}
          
          {/* Node icon */}
          <Box sx={{ mr: 1, color: 'text.secondary' }}>
            <CircleIcon sx={{ fontSize: 12 }} />
          </Box>
          
          {/* Node label */}
          <Typography
            variant="body2"
            sx={{
              flexGrow: 1,
              fontWeight: hasChildren ? 500 : 400,
              color: hasChildren ? 'text.primary' : 'text.secondary',
            }}
          >
            {node.label}
          </Typography>
          
          {/* Child count */}
          {hasChildren && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: '0.75rem',
              }}
            >
              {node.children!.length}
            </Typography>
          )}
        </Box>
        
        {/* Child nodes */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box>
              {node.children!.map(child => renderTreeNode(child))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };
  
  const expandAll = () => {
    const allNodeIds = new Set<string>();
    const collectNodeIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          allNodeIds.add(node.id);
          collectNodeIds(node.children);
        }
      });
    };
    collectNodeIds(treeData);
    setExpandedNodes(allNodeIds);
  };
  
  const collapseAll = () => {
    setExpandedNodes(new Set());
  };
  
  if (treeData.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          color: 'text.secondary',
        }}
      >
        <AccountTreeIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
        <Typography variant="body2">
          Unable to parse tree data
        </Typography>
        <Typography variant="caption" sx={{ mt: 1, textAlign: 'center' }}>
          Make sure the data is valid triplet, JSON, or indented text
        </Typography>
        <Typography variant="caption" sx={{ mt: 1, textAlign: 'center', fontSize: '0.7rem' }}>
          Data:{content.substring(0, 200)}...
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ width: '100%', maxHeight: '600px', overflow: 'auto' }}>
      {/* Actions */}
      <Box sx={{ 
        display: 'flex', 
        gap: 1, 
        mb: 2,
        pb: 1,
        borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
      }}>
        <IconButton
          size="small"
          onClick={expandAll}
          sx={{ 
            fontSize: '0.875rem',
            color: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.main',
              color: 'white',
            }
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
        <Typography variant="caption" sx={{ pt: 1 }}>
          Expand all
        </Typography>
        
        <IconButton
          size="small"
          onClick={collapseAll}
          sx={{ 
            ml: 2,
            fontSize: '0.875rem',
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'text.secondary',
              color: 'white',
            }
          }}
        >
          <ExpandLessIcon />
        </IconButton>
        <Typography variant="caption" sx={{ pt: 1 }}>
          Collapse all
        </Typography>
      </Box>
      
      {/* Tree */}
      <Box>
        {treeData.map(node => renderTreeNode(node))}
      </Box>
    </Box>
  );
};

export default TreeViewer; 