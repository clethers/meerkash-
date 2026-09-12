import styles from './AmbientBackdrop.module.css';

/** Fixed, decorative gradient-blob layer behind every screen — the "glass" in
 * glassmorphism needs something colorful and blurred to refract. Renders
 * once per top-level layout (app shell, auth shell, landing). */
export function AmbientBackdrop() {
  return <div className={styles.backdrop} aria-hidden="true" />;
}
