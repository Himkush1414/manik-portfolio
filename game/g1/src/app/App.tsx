// App shell: DOM overlay above the single WebGL canvas. The flow FSM decides
// which overlay screens show; the World mounts once its geometry is built.
import { useEffect } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { CanvasRoot, hasWebGL2 } from '../render/CanvasRoot';
import { World } from '../scenes/World';
import { WebGLUnsupported } from '../ui/screens/WebGLUnsupported';
import { useLoader, startLoading } from '../core/loader';
import { registerBootTasks } from './bootLoader';
import { applyStartParams } from './startParams';

export function App() {
  useEffect(() => {
    registerBootTasks();
    applyStartParams();
    void startLoading();
  }, []);
  const geometryReady = useLoader(s => s.completed.includes('geometry'));
  if (!hasWebGL2()) return <WebGLUnsupported />;
  return (
    <ErrorBoundary>
      <CanvasRoot>{geometryReady && <World />}</CanvasRoot>
    </ErrorBoundary>
  );
}
