// App shell: DOM overlay above the single WebGL canvas. Scene/screens are
// chosen by the flow FSM (slices 1B+); slice 1A renders the engine lookdev.
import { ErrorBoundary } from './ErrorBoundary';
import { CanvasRoot, hasWebGL2 } from '../render/CanvasRoot';
import { Lookdev } from '../scenes/Lookdev';
import { WebGLUnsupported } from '../ui/screens/WebGLUnsupported';

export function App() {
  if (!hasWebGL2()) return <WebGLUnsupported />;
  return (
    <ErrorBoundary>
      <CanvasRoot>
        <Lookdev />
      </CanvasRoot>
    </ErrorBoundary>
  );
}
