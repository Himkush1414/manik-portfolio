// App shell: DOM overlay above the single WebGL canvas. The flow FSM decides
// which overlay screens show; the World mounts once its geometry is built.
import { useEffect, useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { CanvasRoot, hasWebGL2 } from '../render/CanvasRoot';
import { Stage } from '../scenes/Stage';
import { WebGLUnsupported } from '../ui/screens/WebGLUnsupported';
import { useLoader, startLoading } from '../core/loader';
import { registerBootTasks } from './bootLoader';
import { applyStartParams, startMode } from './startParams';
import { installDoorFeedback } from './choreo/doorFeedback';
import { useFlow, isBoot } from './flow';
import { BootController } from './BootController';
import { AudioHint } from '../ui/screens/AudioHint';

export function App() {
  useEffect(() => {
    registerBootTasks();
    applyStartParams();
    installDoorFeedback();
    void startLoading();
  }, []);
  const fontsReady = useLoader(s => s.completed.includes('fonts'));
  const flowState = useFlow(s => s.state);
  const [bootMounted, setBootMounted] = useState(startMode() === 'boot');
  if (!hasWebGL2()) return <WebGLUnsupported />;
  return (
    <ErrorBoundary>
      <CanvasRoot>
        <Stage />
      </CanvasRoot>
      {/* t=0 waits for fonts (brief §8): SplitText must measure the real face */}
      {bootMounted && fontsReady && isBoot(flowState) && <BootController onDone={() => setBootMounted(false)} />}
      <AudioHint />
    </ErrorBoundary>
  );
}
