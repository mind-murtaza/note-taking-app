import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SHARED_PACKAGE } from '@app/shared';

// Placeholder entry — real pages/components/routing arrive in AB-1010+.
function App() {
  return <div>Note-taking App ({SHARED_PACKAGE})</div>;
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
