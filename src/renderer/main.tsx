import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import './styles/base.css';

// No StrictMode: CodeMirror mounts an imperative EditorView, and the double
// mount in development would create and destroy a second view for every tab.
const container = document.getElementById('root');
if (!container) {
  throw new Error('root container missing');
}
createRoot(container).render(<App />);
