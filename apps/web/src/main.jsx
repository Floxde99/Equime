import React from 'react';
import ReactDOM from 'react-dom/client';

// Polices auto-hébergées (RGPD : pas de CDN Google Fonts)
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import './styles/index.css';

import { Providers } from './providers.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers />
  </React.StrictMode>
);
