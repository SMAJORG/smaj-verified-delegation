"use client";

import { useEffect, useRef } from "react";
import BrandLogo from "./BrandLogo";
import styles from "./HomepageWorkflow.module.css";

function MiniIcon({ kind }: { kind: "plan" | "check" | "proof" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "plan" && <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M9 8h6m-6 4h6m-6 4h3" /></>}
    {kind === "check" && <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>}
    {kind === "proof" && <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8 14h8m-8 3h5" /></>}
  </svg>;
}

function MessageHeader({ label = "Plan preview" }: { label?: string }) {
  return <div className={styles.messageHeader}><BrandLogo className={styles.logo} /><div><strong>SMAJ AI</strong><span>{label}</span></div><span className={styles.spark} aria-hidden="true">✦</span></div>;
}

const recommendations = [
  { title: "Review matching opportunities", status: "Suggested", kind: "plan" as const },
  { title: "Approve selected mock actions", status: "Your decision", kind: "check" as const },
  { title: "Keep a record of the outcome", status: "PDF + JSON", kind: "proof" as const },
];

function RecommendationsIllustration() {
  return <div className={`${styles.illustration} ${styles.recommendationVisual}`} role="img" aria-label="Illustrative SMAJ AI conversation with three suggestions: review matching opportunities, approve selected mock actions, and keep PDF and JSON proof.">
    <div className={styles.decorativeSheet} aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <div className={styles.glassFrame} aria-hidden="true">
      <div className={styles.message}>
        <MessageHeader label="Illustrative recommendations" />
        <p>Based on the goal and skills you shared, here are three suggested next steps.</p>
        <div className={styles.recommendations}>{recommendations.map(item => <div className={styles.recommendation} key={item.title}>
          <span className={styles.smallIcon}><MiniIcon kind={item.kind} /></span><div><strong>{item.title}</strong><span>{item.status}</span></div><span className={styles.recommendationArrow}>↗</span>
        </div>)}</div>
        <div className={styles.messageNote}><span />Prepared for your review</div>
      </div>
    </div>
  </div>;
}

function GoalIllustration() {
  return <div className={`${styles.illustration} ${styles.goalVisual}`} role="img" aria-label="Example goal: Find software engineering opportunities matching my skills. SMAJ AI prepares a plan for review.">
    <div className={styles.goalBubble} aria-hidden="true"><span className={styles.userAvatar}>You</span><p>Find software engineering opportunities matching my skills.</p></div>
    <div className={`${styles.glassFrame} ${styles.stepFrame}`} aria-hidden="true"><div className={styles.message}>
      <MessageHeader label="Meta AI-powered planning" />
      <p>I’ll prepare a plan using the sample Jobs data for you to review.</p>
      <div className={styles.planLine}><span>01</span>Review matching opportunities</div>
      <div className={styles.planLine}><span>02</span>Prepare proposed actions</div>
      <div className={styles.messageNote}><span />Plan prepared · Awaiting review</div>
    </div></div>
  </div>;
}

function ApprovalIllustration() {
  return <div className={`${styles.illustration} ${styles.approvalVisual}`} role="img" aria-label="Illustrative approval checkpoint: review the proposed mock Jobs actions before approving. Nothing executes before approval.">
    <div className={`${styles.glassFrame} ${styles.stepFrame}`} aria-hidden="true"><div className={styles.message}>
      <MessageHeader label="Approval checkpoint" />
      <div className={styles.approvalHeading}><span className={styles.smallIcon}><MiniIcon kind="check" /></span><strong>Your approval comes first.</strong></div>
      <p>Review the plan and select the mock Jobs actions you want to approve.</p>
      <div className={styles.selection}><span>✓</span> Selected mock Jobs actions</div>
      <div className={styles.approvalStatus}><MiniIcon kind="check" />Awaiting your approval</div>
      <div className={styles.messageNote}>No real applications or payments.</div>
    </div></div>
  </div>;
}

function ProofIllustration() {
  return <div className={`${styles.illustration} ${styles.proofVisual}`} role="img" aria-label="Example simulated delegation record: approved, simulated, verified. Proof receipt available as PDF and JSON.">
    <div className={`${styles.glassFrame} ${styles.stepFrame}`} aria-hidden="true"><div className={styles.message}>
      <MessageHeader label="Example completed demo" />
      <div className={styles.progress}>{["Approved", "Simulated", "Verified"].map(label => <span key={label}><i>✓</i>{label}</span>)}</div>
      <div className={styles.proofReceipt}><span className={styles.smallIcon}><MiniIcon kind="proof" /></span><div><strong>Verification receipt</strong><span>Plan, approval & outcome record</span></div></div>
      <div className={styles.formats}><span><MiniIcon kind="proof" />PDF receipt</span><span><MiniIcon kind="plan" />JSON proof</span></div>
      <div className={styles.messageNote}><span />Simulated actions · Verifiable record</div>
    </div></div>
  </div>;
}

const steps = [
  { title: "Describe Your Goal", description: "Enter a task and let SMAJ AI prepare an actionable plan.", illustration: GoalIllustration },
  { title: "Review and Approve", description: "Review the proposed actions and approve them before execution.", illustration: ApprovalIllustration },
  { title: "Track and Verify", description: "Follow the simulated delegation workflow and download PDF/JSON proof receipts.", illustration: ProofIllustration },
];

export default function HomepageWorkflow() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.visible);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    element.querySelectorAll(`.${styles.reveal}`).forEach(item => observer.observe(item));
    element.classList.add(styles.motionReady);
    return () => observer.disconnect();
  }, []);

  return <div className={styles.root} ref={root}>
    <section className={styles.learningSection} aria-labelledby="workflow-learning-heading">
      <div className={`${styles.learningCard} ${styles.reveal}`}>
        <div className={styles.learningCopy}>
          <h2 id="workflow-learning-heading">Gets Better<br /><span>Over Time.</span></h2>
          <p className={styles.subtitle}>Learns your workflow.</p>
          <p>Share your goal, skills, and preferences to help SMAJ AI prepare a more relevant plan.</p>
          <p className={styles.clarification}>Guided by the context you provide. The current demo does not automatically learn or remember your preferences across tasks.</p>
        </div>
        <RecommendationsIllustration />
      </div>
    </section>
    <section className={styles.howSection} aria-labelledby="workflow-steps-heading">
      <header className={`${styles.sectionHeader} ${styles.reveal}`}>
        <span className={styles.label}>How it works</span>
        <h2 id="workflow-steps-heading">From Goal to Proof<br /><span>in Three Steps.</span></h2>
      </header>
      <ol className={styles.steps}>{steps.map((step, index) => <li className={`${styles.stepCard} ${styles.reveal}`} key={step.title}>
        <step.illustration />
        <div className={styles.stepCopy}><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><p>{step.description}</p></div>
      </li>)}</ol>
    </section>
  </div>;
}
