import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import LargeContentViewer from './LargeContentViewer';

interface StructuredContentRendererProps {
  content: string;
  thoughtProcess?: string[]; // Thought process, used to extract graph content
}

// Process content by replacing graph markers with placeholders to preserve position
const smartContentProcessing = (content: string, hasAdditionalGraph: boolean): string => {
  try {
    let result = content;
    
    // Unescape JSON and clean formatting
    result = result
      // Remove JSON escape sequences
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      // Collapse extra blank lines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim leading and trailing whitespace
      .replace(/^\s+/, '')
      .replace(/\s+$/, '');
      
    // Filter out debug messages
    const debugPatterns = [
      /^Starting analysis for query:.*?\n/im,
      /^Loading and processing documents.*?\n/im,
      /^Structure selection result:.*?\n/im,
      /^Verification Result:.*?\n/im,
    ];
    
    for (const pattern of debugPatterns) {
      result = result.replace(pattern, '');
    }
    
    // If graph content was extracted from the thought process, replace the original graph markers with placeholders to preserve position
    if (hasAdditionalGraph) {
      
      const graphBlockPatterns = [
        // Match a complete graph marker block
        /<Graph\s+START>[\s\S]*?<Graph\s+END>/gi,
        /<Graph START>[\s\S]*?<Graph END>/gi,
        // Match graph content inside an [EXTRACT] code block
        /\[EXTRACT\]\s*```[\s\S]*?<Graph START>[\s\S]*?<Graph END>[\s\S]*?```/gi,
        /\[EXTRACT\]\s*```[\s\S]*?<Graph\s+START>[\s\S]*?<Graph\s+END>[\s\S]*?```/gi
      ];
      
      // Replace these graph blocks with a simple placeholder, keeping position
      // Use a placeholder Markdown will not interpret
      for (const pattern of graphBlockPatterns) {
        result = result.replace(pattern, '\n\n**[GRAPH_PLACEHOLDER]**\n\n');
      }
      
      // Clean up extra blank lines that may have been introduced
      result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
    }
    
    
    return result;
  } catch (error) {
    console.error('StructuredContentRenderer - smartContentProcessing error:', error);
    return content; // return the original content on error
  }
};

// Detect graph markers (marker text only)
const hasGraphMarkers = (content: string): boolean => {
  // Looser detection, including fenced code blocks
  const patterns = [
    // **Priority 1: graph placeholder detection**
    /\*\*\[GRAPH_PLACEHOLDER\]\*\*/i,
    
    // **Priority 2: [EXTRACT] format detection — critical fix**
    /\[EXTRACT\]\s*```[\s\S]*?<Graph START>[\s\S]*?<Graph END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?<Graph\s+START>[\s\S]*?<Graph\s+END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?\([^)]*?,[\s\S]*?\)/i, // Detect triplet format
    
    // Simpler [EXTRACT] detection
    /\[EXTRACT\][\s\S]*?<Graph START>/i,
    /\[EXTRACT\][\s\S]*?Graph START/i,
    
    // Original Graph START/END marker format
    /<Graph\s+START>[\s\S]*?<Graph\s+END>/i,
    /Graph\s+START[\s\S]*?Graph\s+END/i,
    /<Graph START>[\s\S]*?<Graph END>/i,
    /Graph START[\s\S]*?Graph END/i
  ];
  
  const result = patterns.some(pattern => pattern.test(content));
  return result;
};

// Extract graph-marker content (marker text only)
const extractGraphContent = (content: string): string | null => {
  // Try several patterns to extract graph content
  const patterns = [
    // **Priority 1: [EXTRACT] format — exact match based on real samples**
    /\[EXTRACT\]\s*```[\s\S]*?<Graph START>\s*\n([\s\S]*?)<Graph END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?<Graph START>\s*([\s\S]*?)<Graph END>/i,
    /\[EXTRACT\][\s\S]*?<Graph START>[\s\S]*?\n([\s\S]*?)<Graph END>/i,
    /<Graph START>\s*\n([\s\S]*?)<Graph END>/i,
    /<Graph START>\s*([\s\S]*?)<Graph END>/i,
    
    // Handle escaped newlines
    /\[EXTRACT\]\s*```[\s\S]*?<Graph START>\s*\\n([\s\S]*?)<Graph END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?<Graph\s+START>\s*\\n([\s\S]*?)<Graph\s+END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?<Graph\s+START>\s*\n([\s\S]*?)<Graph\s+END>/i,
    
    // Original Graph START/END format
    /<Graph\s+START>([\s\S]*?)<Graph\s+END>/i,
    /<Graph START>([\s\S]*?)<Graph END>/i,
    /Graph\s+START\s*>([\s\S]*?)<\s*Graph\s+END/i,
    /Graph START[\s\S]*?\n([\s\S]*?)Graph END/i,
    
    // Fenced code block format
    /```[\s\S]*?<Graph START>\s*\n([\s\S]*?)<Graph END>[\s\S]*?```/i,
    /```[\s\S]*?<Graph\s+START>\s*\n([\s\S]*?)<Graph\s+END>[\s\S]*?```/i,
    
    // [EXTRACT] wrapped format
    /\[EXTRACT\][\s\S]*?<Graph START>\s*\n([\s\S]*?)<Graph End>/i,
    /\[EXTRACT\][\s\S]*?<Graph\s+START>\s*\n([\s\S]*?)<Graph\s+END>/i,
    
    // Format that includes newlines
    /<Graph START>\s*\\n([\s\S]*?)\\n\s*<Graph END>/i,
    /<Graph\s+START>\s*\\n([\s\S]*?)\\n\s*<Graph\s+END>/i,
    
    // Very loose format
    /Graph\s*START[^a-zA-Z]*?([\s\S]*?)Graph\s*END/i,
  ];
  
  let match = null;
  let usedPattern = -1;
  
  // Try to unescape JSON first
  const processedContent = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  
  for (let i = 0; i < patterns.length; i++) {
    // Try the processed content first
    match = processedContent.match(patterns[i]);
    if (match) {
      usedPattern = i;
      break;
    }
    
    // Then try the original content
    match = content.match(patterns[i]);
    if (match) {
      usedPattern = i;
      break;
    }
  }
  
  const result = match ? match[1].trim() : null;
  return result;
};

// Extract all graph content from the thought process
const extractAllGraphsFromThoughts = (thoughtProcess: string[]): string[] => {
  if (!thoughtProcess || !Array.isArray(thoughtProcess)) {
    return [];
  }
  
  
  // Collect every graph block that was found
  const allGraphs: string[] = [];
  
  // Walk every thought step and collect all graph content
  for (let i = 0; i < thoughtProcess.length; i++) {
    const thought = thoughtProcess[i];
    
    // Check thought steps that contain [EXTRACT]
    if (thought.includes('[EXTRACT]') && thought.includes('<Graph START>') && thought.includes('<Graph END>')) {
      
      try {
        const startMarker = '<Graph START>';
        const endMarker = '<Graph END>';
        const startIndex = thought.indexOf(startMarker);
        const endIndex = thought.indexOf(endMarker);
        
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          let graphContent = thought.substring(startIndex + startMarker.length, endIndex).trim();
          
          // Unescape if needed
          graphContent = graphContent.replace(/\\n/g, '\n');
          
          // Strip leading newlines and spaces
          graphContent = graphContent.replace(/^\s*\n/, '').trim();
          
          if (graphContent && graphContent.includes('(') && graphContent.includes(',')) {
            allGraphs.push(graphContent);
            const tripletCount = (graphContent.match(/\([^)]+\)/g) || []).length;
          }
        }
      } catch (error) {
      }
    }
  }
  
  // If no graph was found, fall back to the generic extractor
  if (allGraphs.length === 0) {
    for (let i = 0; i < thoughtProcess.length; i++) {
      const thought = thoughtProcess[i];
      const graphContent = extractGraphContent(thought);
      if (graphContent) {
        allGraphs.push(graphContent);
        const tripletCount = (graphContent.match(/\([^)]+\)/g) || []).length;
      }
    }
  }
  
  return allGraphs;
};

// Kept for backward compatibility; returns the first graph
const extractGraphFromThoughts = (thoughtProcess: string[]): string | null => {
  const allGraphs = extractAllGraphsFromThoughts(thoughtProcess);
  return allGraphs.length > 0 ? allGraphs[0] : null;
};

// Detect content inside tree markers
const hasTreeMarkers = (content: string): boolean => {
  const patterns = [
    /<Tree\s+START>[\s\S]*?<Tree\s+END>/i,
    /<Tree START>[\s\S]*?<Tree END>/i,
    /\[TREE\]\s*```[\s\S]*?<Tree START>[\s\S]*?<Tree END>/i,
    /\[TREE\]\s*```[\s\S]*?\{[\s\S]*?\}/i, // JSON format
    /\[TREE\][\s\S]*?<Tree START>/i,
    /Tree\s+START[\s\S]*?Tree\s+END/i,
    /Tree START[\s\S]*?Tree END/i
  ];
  
  // Extra check: single-line tree marker format <Tree START> ... <Tree END>
  const hasBasicTreeMarkers = patterns.some(pattern => pattern.test(content));
  const hasTreeTags = content.includes('<Tree START>') && content.includes('<Tree END>');
  
  // Detect triplet format (any relationship type)
  const tripletPatterns = [
    /\([^,)]+,\s*(has_child|has_domain|has_content|has_outcome|collaborates_with|relates_to|contains|includes),\s*[^)]+\)/,
    /\([^,)]+,\s*[^,)]+,\s*[^)]+\)/ // basic triplet format
  ];
  const hasTriplets = tripletPatterns.some(pattern => pattern.test(content));
  
  // Treat it as tree content when a tree marker is present
  const result = hasBasicTreeMarkers || hasTreeTags || (hasTriplets && hasTreeTags);
  
  return result;
};

// Extract content inside tree markers
const extractTreeContent = (content: string): string | null => {
  const patterns = [
    // [TREE] format
    /\[TREE\]\s*```[\s\S]*?<Tree START>\s*\n([\s\S]*?)<Tree END>/i,
    /\[TREE\]\s*```[\s\S]*?<Tree START>\s*([\s\S]*?)<Tree END>/i,
    /\[TREE\][\s\S]*?<Tree START>[\s\S]*?\n([\s\S]*?)<Tree END>/i,
    
    // Single-line tree markers (important)
    /<Tree START>\s*([\s\S]*?)\s*<Tree END>/i,
    /<Tree\s+START>\s*([\s\S]*?)\s*<Tree\s+END>/i,
    
    // Multiline format
    /<Tree START>\s*\n([\s\S]*?)<Tree END>/i,
    
    // JSON format detection
    /\[TREE\]\s*```[\s\S]*?(\{[\s\S]*?\})/i,
    /\[TREE\]\s*(\{[\s\S]*?\})/i,
    
    // Original Tree START/END format
    /Tree\s+START\s*>([\s\S]*?)<\s*Tree\s+END/i,
    /Tree START[\s\S]*?\n([\s\S]*?)Tree END/i,
    
    // Fenced code block format
    /```[\s\S]*?<Tree START>\s*\n([\s\S]*?)<Tree END>[\s\S]*?```/i,
    /```[\s\S]*?<Tree\s+START>\s*\n([\s\S]*?)<Tree\s+END>[\s\S]*?```/i,
  ];
  
  let match = null;
  let usedPattern = -1;
  
  // Try to unescape JSON first
  const processedContent = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  
  for (let i = 0; i < patterns.length; i++) {
    // Try the processed content first
    match = processedContent.match(patterns[i]);
    if (match) {
      usedPattern = i;
      break;
    }
    
    // Then try the original content
    match = content.match(patterns[i]);
    if (match) {
      usedPattern = i;
      break;
    }
  }
  
  const result = match ? match[1].trim() : null;
  
  // If content was extracted, check that it is triplet data or another valid format
  if (result) {
    const tripletPatterns = [
      /\([^,)]+,\s*(has_child|has_domain|has_content|has_outcome|collaborates_with|relates_to|contains|includes),\s*[^)]+\)/,
      /\([^,)]+,\s*[^,)]+,\s*[^)]+\)/ // basic triplet format
    ];
    const hasTriplets = tripletPatterns.some(pattern => pattern.test(result));
    
    // Return the result if it contains triplets or valid JSON/indented text
    if (hasTriplets || result.includes('{') || result.includes('-') || result.includes('*')) {
      return result;
    }
  }
  
  return null;
};

// Extract tree content from the thought process
const extractTreeFromThoughts = (thoughtProcess: string[]): string | null => {
  if (!thoughtProcess || !Array.isArray(thoughtProcess)) {
    return null;
  }
  
  
  // Walk thought steps and look for tree content
  for (let i = 0; i < thoughtProcess.length; i++) {
    const thought = thoughtProcess[i];
    
    // Check thought steps that contain [TREE] or [EXTRACT]
    if ((thought.includes('[TREE]') || thought.includes('[EXTRACT]')) && 
        (thought.includes('<Tree START>') && thought.includes('<Tree END>'))) {
      
      const treeContent = extractTreeContent(thought);
      if (treeContent) {
        return treeContent;
      }
    }
    
    // Look for a JSON tree
    if (thought.includes('[TREE]') && (thought.includes('{') && thought.includes('}'))) {
      const jsonMatch = thought.match(/\[TREE\][\s\S]*?(\{[\s\S]*?\})/);
      if (jsonMatch) {
        try {
          JSON.parse(jsonMatch[1]); // validate JSON
          return jsonMatch[1];
        } catch (e) {
        }
      }
    }
  }
  
  return null;
};

// Build a tree preview
const generateTreePreview = (content: string): string => {
  // Check whether this is triplet format
  const tripletPattern = /\(([^,)]+),\s*([^,)]+),\s*([^)]+)\)/g;
  const triplets = content.match(tripletPattern);
  
  if (triplets && triplets.length > 0) {
    const preview = triplets.slice(0, 5).join('\n');
    return `🌳 Tree Structure (${triplets.length} relations):\n${preview}${triplets.length > 5 ? '\n...' : ''}`;
  }
  
  try {
    // Try to parse JSON
    const jsonData = JSON.parse(content);
    const jsonStr = JSON.stringify(jsonData, null, 2);
    const lines = jsonStr.split('\n');
    const preview = lines.slice(0, 8).join('\n');
    return `🌳 Tree Structure (JSON format):\n${preview}${lines.length > 8 ? '\n...' : ''}`;
  } catch (e) {
    // If it is not JSON, show the indented form
    const lines = content.split('\n').filter(line => line.trim());
    const preview = lines.slice(0, 8).join('\n');
    return `🌳 Tree Structure:\n${preview}${lines.length > 8 ? '\n...' : ''}`;
  }
};

// Detect standalone table regions (strict)
const detectTableRegions = (content: string): Array<{start: number, end: number, content: string}> => {
  const lines = content.split('\n');
  const tableRegions: Array<{start: number, end: number, content: string}> = [];
  
  let currentTableStart = -1;
  let currentTableLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTableLine = line.includes('|') && line.length > 5;
    
    if (isTableLine) {
      if (currentTableStart === -1) {
        currentTableStart = i;
        currentTableLines = [lines[i]];
      } else {
        currentTableLines.push(lines[i]);
      }
    } else {
      // Non-table row: check whether the current table has ended
      if (currentTableStart !== -1) {
        // Check whether the accumulated rows form a large table
        if (currentTableLines.length >= 10) {
          // Check table consistency
          const tableCounts = currentTableLines.map(line => {
            return (line.match(/\|/g) || []).length;
          }).filter(count => count > 2);
          
          if (tableCounts.length >= 8) {
            const firstCount = tableCounts[0];
            const consistentRows = tableCounts.filter(count => count === firstCount).length;
            
            if (consistentRows >= 8 || currentTableLines.length >= 15) {
              // Confirmed as a large table
              const tableContent = currentTableLines.join('\n');
              const startLineIndex = content.split('\n').slice(0, currentTableStart).join('\n').length;
              const endLineIndex = startLineIndex + tableContent.length;
              
              tableRegions.push({
                start: startLineIndex,
                end: endLineIndex,
                content: tableContent
              });
            }
          }
        }
        
        // Reset table state
        currentTableStart = -1;
        currentTableLines = [];
      }
    }
  }
  
  // Handle a table at the end of the file
  if (currentTableStart !== -1 && currentTableLines.length >= 10) {
    const tableCounts = currentTableLines.map(line => {
      return (line.match(/\|/g) || []).length;
    }).filter(count => count > 2);
    
    if (tableCounts.length >= 8) {
      const firstCount = tableCounts[0];
      const consistentRows = tableCounts.filter(count => count === firstCount).length;
      
      if (consistentRows >= 8 || currentTableLines.length >= 15) {
        const tableContent = currentTableLines.join('\n');
        const startLineIndex = content.split('\n').slice(0, currentTableStart).join('\n').length;
        const endLineIndex = startLineIndex + tableContent.length;
        
        tableRegions.push({
          start: startLineIndex,
          end: endLineIndex,
          content: tableContent
        });
      }
    }
  }
  
  return tableRegions;
};

// Build a table preview
const generateTablePreview = (content: string): string => {
  const lines = content.split('\n');
  const tableLines = lines.filter(line => line.includes('|'));
  const preview = tableLines.slice(0, 5).join('\n');
  return `📋 Table Data (${tableLines.length} rows):\n${preview}${tableLines.length > 5 ? '\n...' : ''}`;
};

// Build a graph preview
const generateGraphPreview = (content: string): string => {
  // Try to preview the first few triplets
  const tripletPatterns = [
    /\([^,)]+,\s*[^,)]+,\s*[^)]+\)/g,
    /\([^,)]+,\s*"[^"]*",\s*"[^"]*"\)/g
  ];
  
  for (const pattern of tripletPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const preview = matches.slice(0, 3).join('\n');
      return `📊 Graph Data (${matches.length} relations):\n${preview}${matches.length > 3 ? '\n...' : ''}`;
    }
  }
  
  // If no triplets are found, show the start of the content
  const lines = content.split('\n').filter(line => line.trim());
  const preview = lines.slice(0, 3).join('\n');
  return `📊 Graph Data:\n${preview}${lines.length > 3 ? '\n...' : ''}`;
};

// Markdown renderer
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: ({children}) => (
          <Typography variant="h4" component="h1" sx={{ 
            fontWeight: 'bold', 
            mb: 2, 
            mt: 2,
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '8px'
          }}>
            {children}
          </Typography>
        ),
        h2: ({children}) => (
          <Typography variant="h5" component="h2" sx={{ 
            fontWeight: 'bold', 
            mb: 1.5, 
            mt: 1.5,
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '6px'
          }}>
            {children}
          </Typography>
        ),
        h3: ({children}) => (
          <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold', mb: 1, mt: 1 }}>
            {children}
          </Typography>
        ),
        p: ({children}) => (
          <Typography variant="body1" sx={{ mb: 1, lineHeight: 1.6, color: '#0f172a' }}>
            {children}
          </Typography>
        ),
        strong: ({children}) => (
          <Box component="strong" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
            {children}
          </Box>
        ),
        em: ({children}) => (
          <Box component="em" sx={{ fontStyle: 'italic', color: '#4b5563' }}>
            {children}
          </Box>
        ),
        code: ({children, className}) => {
          const isInline = !className?.includes('language-');
          const language = className?.replace('language-', '') || '';
          
          return isInline ? (
            <Box
              component="code"
              sx={{
                backgroundColor: '#f8f9fa',
                color: '#e83e8c',
                padding: '3px 6px',
                borderRadius: '4px',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '0.9em',
                border: '1px solid #e9ecef',
              }}
            >
              {children}
            </Box>
          ) : (
            <Box sx={{ mb: 2 }}>
              {language && (
                <Box
                  sx={{
                    backgroundColor: '#f8f9fa',
                    padding: '8px 12px',
                    borderRadius: '6px 6px 0 0',
                    fontSize: '0.8em',
                    color: '#6c757d',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    borderBottom: '1px solid #e9ecef',
                    fontWeight: 500,
                  }}
                >
                  {language.toUpperCase()}
                </Box>
              )}
              <Box
                component="pre"
                sx={{
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: 2,
                  borderRadius: language ? '0 0 6px 6px' : '6px',
                  overflow: 'auto',
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  fontSize: '0.9em',
                  margin: 0,
                }}
              >
                <code>{children}</code>
              </Box>
            </Box>
          );
        },
        table: ({children}) => (
          <Box
            sx={{
              overflowX: 'auto',
              mb: 2,
              border: '1px solid #e5e7eb',
              borderRadius: 1,
              backgroundColor: '#fff',
            }}
          >
            <Box component="table" sx={{ 
              width: '100%', 
              borderCollapse: 'separate',
              borderSpacing: 0,
            }}>
              {children}
            </Box>
          </Box>
        ),
        th: ({children}) => (
          <Box
            component="th"
            sx={{
              border: '1px solid #e5e7eb',
              padding: '12px 16px',
              fontWeight: 'bold',
              textAlign: 'left',
              fontSize: '0.9em',
              backgroundColor: '#f9fafb',
              color: '#374151',
            }}
          >
            {children}
          </Box>
        ),
        td: ({children}) => (
          <Box
            component="td"
            sx={{
              border: '1px solid #e5e7eb',
              padding: '10px 16px',
              fontSize: '0.9em',
              color: '#4b5563',
            }}
          >
            {children}
          </Box>
        ),
        blockquote: ({children}) => (
          <Box
            sx={{
              borderLeft: '4px solid #2563eb',
              paddingLeft: 2,
              marginLeft: 0,
              marginY: 2,
              backgroundColor: '#f8fafc',
              padding: 2,
              borderRadius: '0 6px 6px 0',
              '& p:last-child': { mb: 0 },
            }}
          >
            {children}
          </Box>
        ),
        ul: ({children}) => (
          <Box
            component="ul"
            sx={{
              marginBottom: 2,
              paddingLeft: '20px',
              listStyleType: 'disc',
              '& li': {
                marginBottom: 0.5,
                lineHeight: 1.6,
              }
            }}
          >
            {children}
          </Box>
        ),
        ol: ({children}) => (
          <Box
            component="ol"
            sx={{
              marginBottom: 2,
              paddingLeft: '20px',
              listStyleType: 'decimal',
              '& li': {
                marginBottom: 0.5,
                lineHeight: 1.6,
              }
            }}
          >
            {children}
          </Box>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

// Render mixed content
const renderMixedContent = (content: string, additionalGraphContent?: string | null, allGraphsFromThoughts?: string[], additionalTreeContent?: string | null) => {
  const segments: JSX.Element[] = [];
  let segmentIndex = 0;
  
  // If multiple graph blocks were extracted from the thought process, replace them in place
  if (allGraphsFromThoughts && allGraphsFromThoughts.length > 0) {
    
    // Find every graph marker position
    const graphBlockPatterns = [
      /\*\*\[GRAPH_PLACEHOLDER\]\*\*/gi,
      /```[\s\S]*?<Graph START>[\s\S]*?<Graph END>[\s\S]*?```/gi,
      /<Graph START>[\s\S]*?<Graph END>/gi
    ];
    
    let workingContent = content;
    let graphMatches = [];
    
    // Collect every graph marker position
    for (const pattern of graphBlockPatterns) {
      let match;
      pattern.lastIndex = 0; // reset regex state
      while ((match = pattern.exec(workingContent)) !== null) {
        graphMatches.push({
          index: match.index,
          match: match[0],
          length: match[0].length
        });
        
        // Prevent an infinite loop
        if (pattern.lastIndex <= match.index) {
          break;
        }
      }
    }
    
    // Sort by position
    graphMatches.sort((a, b) => a.index - b.index);
    
    
    // Replace graph markers with the actual graph content
    let lastIndex = 0;
    let graphIndex = 0;
    
    for (const graphMatch of graphMatches) {
      // Add the content before the graph
      if (graphMatch.index > lastIndex) {
        const beforeContent = workingContent.substring(lastIndex, graphMatch.index);
        if (beforeContent.trim()) {
          const tableRegions = detectTableRegions(beforeContent);
          
          if (tableRegions.length > 0) {
            let tableLastIndex = 0;
            
            for (const region of tableRegions) {
              if (region.start > tableLastIndex) {
                const textPart = beforeContent.substring(tableLastIndex, region.start);
                if (textPart.trim()) {
                  segments.push(
                    <MarkdownRenderer key={`text-before-graph-${graphIndex}-${segmentIndex++}`} content={textPart} />
                  );
                }
              }
              
              segments.push(
                <LargeContentViewer
                  key={`table-before-graph-${graphIndex}-${segmentIndex++}`}
                  content={region.content}
                  contentType="table"
                  preview={generateTablePreview(region.content)}
                />
              );
              
              tableLastIndex = region.end;
            }
            
            if (tableLastIndex < beforeContent.length) {
              const remainingText = beforeContent.substring(tableLastIndex);
              if (remainingText.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-remaining-before-graph-${graphIndex}-${segmentIndex++}`} content={remainingText} />
                );
              }
            }
          } else {
            segments.push(
              <MarkdownRenderer key={`text-before-graph-${graphIndex}-${segmentIndex++}`} content={beforeContent} />
            );
          }
        }
      }
      
      // Insert the matching graph content
      if (graphIndex < allGraphsFromThoughts.length) {
        const graphContent = allGraphsFromThoughts[graphIndex];
        if (graphContent && graphContent.trim()) {
          segments.push(
            <LargeContentViewer
              key={`graph-${graphIndex}-${segmentIndex++}`}
              content={graphContent}
              contentType="graph"
              preview={generateGraphPreview(graphContent)}
            />
          );
        }
      }
      
      lastIndex = graphMatch.index + graphMatch.length;
      graphIndex++;
    }
    
    // Render the remaining content
    if (lastIndex < workingContent.length) {
      const remainingContent = workingContent.substring(lastIndex);
      if (remainingContent.trim()) {
        const tableRegions = detectTableRegions(remainingContent);
        
        if (tableRegions.length > 0) {
          let tableLastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > tableLastIndex) {
              const textPart = remainingContent.substring(tableLastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-final-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-final-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            tableLastIndex = region.end;
          }
          
          if (tableLastIndex < remainingContent.length) {
            const finalText = remainingContent.substring(tableLastIndex);
            if (finalText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-final-remaining-${segmentIndex++}`} content={finalText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-final-${segmentIndex++}`} content={remainingContent} />
          );
        }
      }
    }
    
    return (
      <Box>
        {segments}
      </Box>
    );
  }
  
  // If there is only one graph block, use the original logic
  if (additionalGraphContent) {
    
    // Find graph code blocks in the main content (including placeholders)
    const graphBlockPatterns = [
      // Look for placeholders first
      /\*\*\[GRAPH_PLACEHOLDER\]\*\*/gi,
      // Then look for original graph markers
      /```[\s\S]*?<Graph START>[\s\S]*?<Graph END>[\s\S]*?```/gi,
      /<Graph START>[\s\S]*?<Graph END>/gi
    ];
    
    let graphBlockMatch = null;
    let usedPattern = -1;
    
    for (let i = 0; i < graphBlockPatterns.length; i++) {
      const match = content.match(graphBlockPatterns[i]);
      if (match) {
        graphBlockMatch = match;
        usedPattern = i;
        const matchIndex = content.indexOf(match[0]);
        graphBlockMatch.index = matchIndex;
        break;
      }
    }
    
    if (graphBlockMatch && graphBlockMatch.index !== undefined) {
      // Graph code block found; split and render by position
      const beforeGraph = content.substring(0, graphBlockMatch.index);
      const afterGraph = content.substring(graphBlockMatch.index + graphBlockMatch[0].length);
      
      
      // Render the content before the graph
      if (beforeGraph.trim()) {
        const tableRegions = detectTableRegions(beforeGraph);
        
        if (tableRegions.length > 0) {
          let lastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > lastIndex) {
              const textPart = beforeGraph.substring(lastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-before-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-before-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            lastIndex = region.end;
          }
          
          if (lastIndex < beforeGraph.length) {
            const remainingText = beforeGraph.substring(lastIndex);
            if (remainingText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-before-final-${segmentIndex++}`} content={remainingText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-before-${segmentIndex++}`} content={beforeGraph} />
          );
        }
      }
      
      // Insert the graph content at the right position
      segments.push(
        <LargeContentViewer
          key={`graph-from-thoughts-${segmentIndex++}`}
          content={additionalGraphContent}
          contentType="graph"
          preview={generateGraphPreview(additionalGraphContent)}
        />
      );
      
      // Render the content after the graph
      if (afterGraph.trim()) {
        const tableRegions = detectTableRegions(afterGraph);
        
        if (tableRegions.length > 0) {
          let lastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > lastIndex) {
              const textPart = afterGraph.substring(lastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-after-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-after-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            lastIndex = region.end;
          }
          
          if (lastIndex < afterGraph.length) {
            const remainingText = afterGraph.substring(lastIndex);
            if (remainingText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-after-final-${segmentIndex++}`} content={remainingText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-after-${segmentIndex++}`} content={afterGraph} />
          );
        }
      }
      
      return (
        <Box>
          {segments}
        </Box>
      );
    } else {
      // No graph code block found; prepend the graph, then render the rest of the content
      
      segments.push(
        <LargeContentViewer
          key={`graph-from-thoughts-${segmentIndex++}`}
          content={additionalGraphContent}
          contentType="graph"
          preview={generateGraphPreview(additionalGraphContent)}
        />
      );
      
      // Continue with the original content
      const tableRegions = detectTableRegions(content);
      
      if (tableRegions.length > 0) {
        let lastIndex = 0;
        
        for (const region of tableRegions) {
          if (region.start > lastIndex) {
            const textPart = content.substring(lastIndex, region.start);
            if (textPart.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
              );
            }
          }
          
          segments.push(
            <LargeContentViewer
              key={`table-${segmentIndex++}`}
              content={region.content}
              contentType="table"
              preview={generateTablePreview(region.content)}
            />
          );
          
          lastIndex = region.end;
        }
        
        if (lastIndex < content.length) {
          const remainingText = content.substring(lastIndex);
          if (remainingText.trim()) {
            segments.push(
              <MarkdownRenderer key={`text-final-${segmentIndex++}`} content={remainingText} />
            );
          }
        }
      } else {
        segments.push(
          <MarkdownRenderer key={`text-${segmentIndex++}`} content={content} />
        );
      }
      
      return (
        <Box>
          {segments}
        </Box>
      );
    }
  }
  
  // Handle tree content
  if (additionalTreeContent) {
    
    // Find tree marker positions
    const treeBlockPatterns = [
      /```[\s\S]*?<Tree START>[\s\S]*?<Tree END>[\s\S]*?```/gi,
      /<Tree START>[\s\S]*?<Tree END>/gi,
      /\[TREE\][\s\S]*?```[\s\S]*?```/gi
    ];
    
    let treeBlockMatch = null;
    let usedPattern = -1;
    
    for (let i = 0; i < treeBlockPatterns.length; i++) {
      const match = content.match(treeBlockPatterns[i]);
      if (match) {
        treeBlockMatch = match;
        usedPattern = i;
        const matchIndex = content.indexOf(match[0]);
        treeBlockMatch.index = matchIndex;
        break;
      }
    }
    
    if (treeBlockMatch && treeBlockMatch.index !== undefined) {
      // Tree code block found; split and render by position
      const beforeTree = content.substring(0, treeBlockMatch.index);
      const afterTree = content.substring(treeBlockMatch.index + treeBlockMatch[0].length);
      
      
      // Render the content before the tree
      if (beforeTree.trim()) {
        const tableRegions = detectTableRegions(beforeTree);
        
        if (tableRegions.length > 0) {
          let lastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > lastIndex) {
              const textPart = beforeTree.substring(lastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-before-tree-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-before-tree-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            lastIndex = region.end;
          }
          
          if (lastIndex < beforeTree.length) {
            const remainingText = beforeTree.substring(lastIndex);
            if (remainingText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-before-tree-final-${segmentIndex++}`} content={remainingText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-before-tree-${segmentIndex++}`} content={beforeTree} />
          );
        }
      }
      
      // Insert the tree content at the right position
      segments.push(
        <LargeContentViewer
          key={`tree-from-thoughts-${segmentIndex++}`}
          content={additionalTreeContent}
          contentType="tree"
          preview={generateTreePreview(additionalTreeContent)}
        />
      );
      
      // Render the content after the tree
      if (afterTree.trim()) {
        const tableRegions = detectTableRegions(afterTree);
        
        if (tableRegions.length > 0) {
          let lastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > lastIndex) {
              const textPart = afterTree.substring(lastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-after-tree-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-after-tree-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            lastIndex = region.end;
          }
          
          if (lastIndex < afterTree.length) {
            const remainingText = afterTree.substring(lastIndex);
            if (remainingText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-after-tree-final-${segmentIndex++}`} content={remainingText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-after-tree-${segmentIndex++}`} content={afterTree} />
          );
        }
      }
      
      return (
        <Box>
          {segments}
        </Box>
      );
    } else {
      // No tree code block found; prepend the tree, then render the rest of the content
      
      segments.push(
        <LargeContentViewer
          key={`tree-from-thoughts-${segmentIndex++}`}
          content={additionalTreeContent}
          contentType="tree"
          preview={generateTreePreview(additionalTreeContent)}
        />
      );
      
      // Continue with the original content
      const tableRegions = detectTableRegions(content);
      
      if (tableRegions.length > 0) {
        let lastIndex = 0;
        
        for (const region of tableRegions) {
          if (region.start > lastIndex) {
            const textPart = content.substring(lastIndex, region.start);
            if (textPart.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
              );
            }
          }
          
          segments.push(
            <LargeContentViewer
              key={`table-${segmentIndex++}`}
              content={region.content}
              contentType="table"
              preview={generateTablePreview(region.content)}
            />
          );
          
          lastIndex = region.end;
        }
        
        if (lastIndex < content.length) {
          const remainingText = content.substring(lastIndex);
          if (remainingText.trim()) {
            segments.push(
              <MarkdownRenderer key={`text-final-${segmentIndex++}`} content={remainingText} />
            );
          }
        }
      } else {
        segments.push(
          <MarkdownRenderer key={`text-${segmentIndex++}`} content={content} />
        );
      }
      
      return (
        <Box>
          {segments}
        </Box>
      );
    }
  }
  
  // Then handle graph markers in the main content (when there is no additionalGraphContent)
  if (hasGraphMarkers(content)) {
    // Support several graph forms: placeholders, original markers, and others
    const graphPatterns = [
      // Placeholder form (preferred)
      /\*\*\[GRAPH_PLACEHOLDER\]\*\*/gi,
      // Original graph markers
      /<Graph\s+START>([\s\S]*?)<Graph\s+END>/gi,
      /<Graph START>([\s\S]*?)<Graph END>/gi
    ];
    
    let graphMatches = [];
    
    // Collect every graph match
    for (const pattern of graphPatterns) {
      let match;
      pattern.lastIndex = 0; // reset regex state
      while ((match = pattern.exec(content)) !== null) {
        graphMatches.push({
          index: match.index,
          match: match[0],
          content: match[1] || '', // placeholders have no content group
          isPlaceholder: pattern.source.includes('GRAPH_PLACEHOLDER')
        });
        
        // Prevent an infinite loop
        if (pattern.lastIndex <= match.index) {
          break;
        }
      }
    }
    
    // Sort by position
    graphMatches.sort((a, b) => a.index - b.index);
    
    let lastIndex = 0;
    
    for (const graphMatch of graphMatches) {
      // Render content before the graph
      if (graphMatch.index > lastIndex) {
        const beforeText = content.substring(lastIndex, graphMatch.index);
        if (beforeText.trim()) {
          // Look for tables in the preceding content
          const tableRegions = detectTableRegions(beforeText);
          
          if (tableRegions.length > 0) {
            // Table regions found; render them in segments
            let textLastIndex = 0;
            
            for (const region of tableRegions) {
              // Add the text before the table
              if (region.start > textLastIndex) {
                const textPart = beforeText.substring(textLastIndex, region.start);
                if (textPart.trim()) {
                  segments.push(
                    <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
                  );
                }
              }
              
              // Add the table
              segments.push(
                <LargeContentViewer
                  key={`table-${segmentIndex++}`}
                  content={region.content}
                  contentType="table"
                  preview={generateTablePreview(region.content)}
                />
              );
              
              textLastIndex = region.end;
            }
            
            // Add the remaining text
            if (textLastIndex < beforeText.length) {
              const remainingText = beforeText.substring(textLastIndex);
              if (remainingText.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-${segmentIndex++}`} content={remainingText} />
                );
              }
            }
          } else {
            // No table; render the text directly
            segments.push(
              <MarkdownRenderer key={`text-${segmentIndex++}`} content={beforeText} />
            );
          }
        }
      }
      
      // Add graph content
      // If this is a placeholder, use additionalGraphContent; otherwise use the extracted content
      const graphContent = graphMatch.isPlaceholder ? 
        (additionalGraphContent || 'No graph data available') : 
        graphMatch.content.trim();
        
      if (graphContent && graphContent !== 'No graph data available') {
        segments.push(
          <LargeContentViewer
            key={`graph-${segmentIndex++}`}
            content={graphContent}
            contentType="graph"
            preview={generateGraphPreview(graphContent)}
          />
        );
      }
      
      lastIndex = graphMatch.index + graphMatch.match.length;
    }
    
    // Render content remaining after the graph
    if (lastIndex < content.length) {
      const remainingContent = content.substring(lastIndex);
      if (remainingContent.trim()) {
        const tableRegions = detectTableRegions(remainingContent);
        
        if (tableRegions.length > 0) {
          let textLastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > textLastIndex) {
              const textPart = remainingContent.substring(textLastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            textLastIndex = region.end;
          }
          
          if (textLastIndex < remainingContent.length) {
            const finalText = remainingContent.substring(textLastIndex);
            if (finalText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-${segmentIndex++}`} content={finalText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-${segmentIndex++}`} content={remainingContent} />
          );
        }
      }
    }
  } else {
    // No graph markers; handle tables only
    const tableRegions = detectTableRegions(content);
    
    if (tableRegions.length > 0) {
      let lastIndex = 0;
      
      for (const region of tableRegions) {
        // Add the text before the table
        if (region.start > lastIndex) {
          const textPart = content.substring(lastIndex, region.start);
          if (textPart.trim()) {
            segments.push(
              <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
            );
          }
        }
        
        // Add the table
        segments.push(
          <LargeContentViewer
            key={`table-${segmentIndex++}`}
            content={region.content}
            contentType="table"
            preview={generateTablePreview(region.content)}
          />
        );
        
        lastIndex = region.end;
      }
      
      // Add the remaining text
      if (lastIndex < content.length) {
        const remainingText = content.substring(lastIndex);
        if (remainingText.trim()) {
          segments.push(
            <MarkdownRenderer key={`text-${segmentIndex++}`} content={remainingText} />
          );
        }
      }
    } else {
      // No special content; render directly
      return <MarkdownRenderer content={content} />;
    }
  }
  
  return (
    <Box sx={{ 
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      '& > *': {
        maxWidth: '100%'
      }
    }}>
      {segments}
    </Box>
  );
};

const StructuredContentRenderer: React.FC<StructuredContentRendererProps> = ({ content, thoughtProcess }) => {
  // Extract all graph content
  const allGraphsFromThoughts = useMemo(() => {
    return thoughtProcess ? extractAllGraphsFromThoughts(thoughtProcess) : [];
  }, [thoughtProcess]);

  // Still expose the first graph for backward compatibility
  const graphFromThoughts = useMemo(() => {
    return allGraphsFromThoughts.length > 0 ? allGraphsFromThoughts[0] : null;
  }, [allGraphsFromThoughts]);

  // Extract tree content
  const treeFromThoughts = useMemo(() => {
    return thoughtProcess ? extractTreeFromThoughts(thoughtProcess) : null;
  }, [thoughtProcess]);

  // Apply smart content processing
  const normalizedContent = useMemo(() => {
    return smartContentProcessing(content, allGraphsFromThoughts.length > 0);
  }, [content, allGraphsFromThoughts]);

  // Analyze content
  const contentAnalysis = useMemo(() => {
    const hasGraph = hasGraphMarkers(normalizedContent);
    const hasGraphInThoughts = allGraphsFromThoughts.length > 0;
    const hasTree = hasTreeMarkers(normalizedContent);
    const hasTreeInThoughts = treeFromThoughts !== null;
    const tableRegions = detectTableRegions(normalizedContent);
    const hasTable = tableRegions.length > 0;
    
    return {
      hasGraph: hasGraph || hasGraphInThoughts,
      hasTree: hasTree || hasTreeInThoughts,
      hasTable,
      needsSpecialHandling: hasGraph || hasGraphInThoughts || hasTree || hasTreeInThoughts || hasTable,
      graphFromThoughts,
      allGraphsFromThoughts,
      treeFromThoughts
    };
  }, [content, normalizedContent, graphFromThoughts, allGraphsFromThoughts, treeFromThoughts]);

  // If there is no special content, render Markdown directly
  if (!contentAnalysis.needsSpecialHandling) {
    return <MarkdownRenderer content={normalizedContent} />;
  }

  // Special content present; use mixed rendering
  return renderMixedContent(
    normalizedContent, 
    contentAnalysis.graphFromThoughts, 
    contentAnalysis.allGraphsFromThoughts, 
    contentAnalysis.treeFromThoughts
  );
};

export default StructuredContentRenderer; 