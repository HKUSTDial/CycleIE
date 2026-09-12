import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import 'katex/dist/katex.min.css';
import Router from './components/Router';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
); 