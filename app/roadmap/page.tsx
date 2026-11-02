import type { Metadata } from "next";
import styles from "./roadmap.module.css";

export const metadata: Metadata = {
  title: "SMAJ AI Expansion Roadmap (2026–2028)",
  description: "Explore the SMAJ AI roadmap for connected conversations, safer actions, voice, and the SMAJ PI HUB ecosystem.",
};

const phases = [
  {
    title: "Intelligent Conversations",
    status: "Available now",
    planned: false,
    description: "Continue chats with saved context and conversation history.",
  },
  {
    title: "AI Actions",
    status: "Available now",
    planned: false,
    description: "Review supported actions, approve sensitive steps, and track verified results.",
  },
  {
    title: "Voice AI",
    status: "Planned",
    planned: true,
    description: "Talk with SMAJ AI and hear helpful responses.",
  },
  {
    title: "Real-Time Calls",
    status: "Planned",
    planned: true,
    description: "Bring natural, live voice conversations to the assistant.",
  },
  {
    title: "AI Across SMAJ PI HUB",
    status: "Planned",
    planned: true,
    description: "Expand coordinated AI support across SMAJ PI HUB services.",
  },
  {
    title: "Mobile Assistant",
    status: "Planned",
    planned: true,
    description: "Make SMAJ AI easier to reach and use on the go.",
  },
  {
    title: "Advanced Autonomous AI",
    status: "Planned",
    planned: true,
    description: "Enable more capable assistance while keeping people in control.",
  },
];

export default function RoadmapPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="SMAJ AI home">
          <img src="/image.png" alt="" width="42" height="42" />
          <span>SMAJ AI</span>
        </a>
        <a className={styles.backLink} href="/">Back to SMAJ AI <span aria-hidden="true">↗</span></a>
      </header>

      <section className={styles.intro} aria-labelledby="roadmap-title">
        <p className={styles.eyebrow}>OUR DIRECTION</p>
        <h1 id="roadmap-title">SMAJ AI Expansion Roadmap <span>(2026–2028)</span></h1>
        <p className={styles.vision}>One AI. One identity. All SMAJ PI HUB services.</p>
        <div className={styles.legend} aria-label="Roadmap status">
          <span><i className={styles.availableDot} /> Available now</span>
          <span><i className={styles.plannedDot} /> Planned</span>
        </div>
      </section>

      <ol className={styles.timeline} aria-label="SMAJ AI roadmap phases">
        {phases.map((phase, index) => (
          <li className={styles.phase} key={phase.title}>
            <span className={`${styles.marker} ${phase.planned ? styles.futureMarker : ""}`} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <article className={styles.card}>
              <div className={styles.cardHeading}>
                <h2>{phase.title}</h2>
                <span className={`${styles.status} ${phase.planned ? styles.planned : styles.available}`}>
                  {phase.status}
                </span>
              </div>
              <p>{phase.description}</p>
            </article>
          </li>
        ))}
      </ol>
      <footer className={styles.footer}>A direction for what’s next. Planned features and timing may evolve.</footer>
    </main>
  );
}
