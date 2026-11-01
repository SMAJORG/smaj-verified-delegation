import styles from "./DemoLoading.module.css";

export default function DemoLoading() {
  return (
    <main className={`workspace ${styles.loading}`} aria-busy="true" aria-label="Loading demo workspace">
      <p className="visuallyHidden" role="status">Preparing your demo workspace…</p>
      <div className={`workspaceHeader ${styles.header}`} aria-hidden="true">
        <span className={`${styles.shimmer} ${styles.brand}`} />
        <span className={`${styles.shimmer} ${styles.avatar}`} />
      </div>
      <div className="workspaceBody homeBody" aria-hidden="true">
        <div className={`${styles.shimmer} ${styles.notice}`} />
        <div className={`${styles.shimmer} ${styles.title}`} />
        <div className={`centralComposer compactComposer ${styles.composer}`}>
          <span className={`${styles.shimmer} ${styles.prompt}`} />
          <div className={styles.toolbar}><span className={`${styles.shimmer} ${styles.chip}`} /><span className={`${styles.shimmer} ${styles.chip}`} /></div>
        </div>
        <div className={`${styles.shimmer} ${styles.connection}`} />
        <div className={styles.services}>{Array.from({ length: 8 }, (_, index) => <span className={`${styles.shimmer} ${styles.service}`} key={index} />)}</div>
      </div>
    </main>
  );
}
