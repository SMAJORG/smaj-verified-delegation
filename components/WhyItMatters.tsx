import styles from "./WhyItMatters.module.css";

const comparison = [
  ["What matters", "SMAJ AI"],
  ["Action plan", "Structured AI plan"],
  ["Control", "Explicit approval"],
  ["Failures", "Recovery tracking"],
  ["Evidence", "PDF + JSON proof"],
  ["Delegation", "Approved task workflow"],
  ["Transparency", "Track every step"],
];

export default function WhyItMatters() {
  return (
    <section className="wrap" id="compare" aria-labelledby="why-it-matters-heading">
      <span className="sectionlabel">Why it matters</span>
      <h2 className="sectiontitle" id="why-it-matters-heading">A chatbot replies.<br />SMAJ AI tracks the work.</h2>
      <div className={`comparison ${styles.comparison}`} role="table" aria-label="SMAJ AI comparison">
        {comparison.map((row, index) => <div className="row" role="row" key={row[0]}>{row.map((cell, column) => <div role={index === 0 ? "columnheader" : column === 0 ? "rowheader" : "cell"} key={cell}>{cell}</div>)}</div>)}
      </div>
    </section>
  );
}
