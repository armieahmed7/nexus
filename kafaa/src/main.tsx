import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installChunkReload } from './shell/chunkReload';
import './styles/index.css';

// After a deploy, chunks of the previous build 404: reload once to pick up the new index.html (src/shell/chunkReload.ts).
installChunkReload();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
