import styles from './WebGLUnsupported.module.css';

export function WebGLUnsupported() {
  return (
    <main className={styles.screen} aria-label="SPACE WAR: DARK EDITION — graphics unavailable">
      <p className={styles.code}>SYS.CHECK // GRAPHICS // FAIL</p>
      <h1 className={styles.title}>WebGL 2 unavailable</h1>
      <p className={styles.body}>
        SPACE WAR: DARK EDITION renders in real time and needs WebGL 2 with hardware acceleration. Enable graphics
        acceleration in your browser settings, or try a current version of Chrome, Edge, Firefox or Safari on a
        desktop computer.
      </p>
    </main>
  );
}
