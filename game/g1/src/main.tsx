// SPACE WAR: DARK EDITION — entry. Fonts are self-hosted (@fontsource, no
// runtime Google requests); only the weights the art bible uses are loaded.
import './render/shaderFixes'; // FIRST: patches three's shader chunks before anything compiles
import '@fontsource/big-shoulders-display/900';
import '@fontsource/big-shoulders-display/700';
import '@fontsource/oxanium/500';
import '@fontsource/oxanium/600';
import '@fontsource/oxanium/700';
import '@fontsource/jetbrains-mono/400';
import '@fontsource/jetbrains-mono/500';
import '@fontsource/ibm-plex-sans/400';
import '@fontsource/ibm-plex-sans/500';
import '@fontsource/mr-dafoe/400';
import './ui/tokens.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initSave } from './state/save';
import { installDebugApi } from './debug/debugApi';

initSave();
installDebugApi();

createRoot(document.getElementById('g1-root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
