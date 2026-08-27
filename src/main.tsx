import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OfficialDataApp from './OfficialDataApp';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Beriday root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <OfficialDataApp />
  </StrictMode>,
);
