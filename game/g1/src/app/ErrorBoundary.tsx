// Styled recovery screen — never a white page.
import { Component, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('[g1] fatal render error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.screen} role="alert" aria-label="SPACE WAR: DARK EDITION — system fault">
        <p className={styles.code}>SYS.FAULT // RENDER CORE</p>
        <h1 className={styles.title}>Systems offline</h1>
        <p className={styles.body}>
          Something failed while bringing the hangar online. Your progress is saved locally and has not been lost.
        </p>
        <button type="button" className={styles.retry} onClick={() => location.reload()}>
          RESTART SYSTEMS
        </button>
      </div>
    );
  }
}
