import BrandLogo from "./BrandLogo";
import styles from "./HomepageWorkflow.module.css";

// Layout and illustrations follow the published homepage reference.
export default function HomepageWorkflow() {
  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <section
          className={styles["card"]}
          aria-labelledby="workflow-learning-heading"
        >
          <div className={styles["intro"]}>
            <h2 id="workflow-learning-heading">
              Gets better{" "}
              <em>
                over
                <br />
                time.
              </em>
            </h2>
            <p className={styles["lead"]}>Designed around your workflow.</p>
            <p className={styles["desc"]}>
              SMAJ AI helps you review plans, decisions, and results with clear
              records you can verify.
            </p>
          </div>
          <div
            className={styles["scene"]}
            role="img"
            aria-label="Illustrative SMAJ AI sample recommendations"
          >
            <div className={styles["message-frame"]}>
              <div className={styles["message"]}>
                <div className={styles["msg-head"]}>
                  <BrandLogo className={styles.logo} />
                  <div>
                    <span className={styles["name"]}>SMAJ AI</span>
                    <span className={styles["time"]}>7:00 AM</span>
                  </div>
                </div>
                <p>Here are 3 sample recommendations ready for your review.</p>
                <div className={styles["recommendations"]}>
                  <div className={styles["recommendation"]}>
                    <span className={styles["icon"]}>◕</span>
                    <span className={styles["label"]}>
                      Store product research
                    </span>
                    <span className={styles["badge"]}>Suggested</span>
                  </div>
                  <div className={styles["recommendation"]}>
                    <span className={styles["icon"]}>♟</span>
                    <span className={styles["label"]}>
                      Jobs opportunity plan
                    </span>
                    <span className={styles["badge"]}>For review</span>
                  </div>
                  <div className={styles["recommendation"]}>
                    <span className={styles["icon"]}>◈</span>
                    <span className={styles["label"]}>
                      Delivery task outline
                    </span>
                    <span className={styles["badge"]}>Draft</span>
                  </div>
                </div>
                <div className={styles["reactions"]}>
                  <span className={styles["reaction"]}>🤔 5</span>
                  <span className={styles["reaction"]}>💯 2</span>
                  <span className={styles["reaction"]}>☺</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          className={styles["how"]}
          aria-labelledby="workflow-steps-heading"
        >
          <span className={styles["pill"]}>How it works</span>
          <h2 id="workflow-steps-heading">
            From your goal.
            <br />
            To{" "}
            <span className={styles["gradient"]}>
              verified
              <br />
              proof.
            </span>
          </h2>
          <article className={styles["step"]}>
            <div
              className={styles["visual"]}
              role="img"
              aria-label="Illustrative Store and Jobs task options"
            >
              <div className={styles["connect-options"]}>
                <div className={styles["connect-option"]}>
                  <span className={styles["app-emoji"]}>🛍️</span>
                  <div>
                    <strong>Choose SMAJ Store</strong>
                    <small>Explore supported tasks</small>
                  </div>
                  <span className={styles["tick"]}>✓</span>
                </div>
                <div className={styles["or"]}>or</div>
                <div className={styles["connect-option"]}>
                  <span className={styles["app-emoji"]}>💼</span>
                  <div>
                    <strong>Choose SMAJ Jobs</strong>
                    <small>Explore supported tasks</small>
                  </div>
                  <span className={styles["tick"]}>✓</span>
                </div>
              </div>
            </div>
            <div className={styles["step-copy"]}>
              <div className={styles["step-title"]}>
                <span className={styles["number"]}>1</span>
                <h3>Describe your goal</h3>
              </div>
              <p>
                Tell SMAJ AI what you want to accomplish. It prepares a
                structured plan for you to review.
              </p>
            </div>
          </article>
          <article className={styles["step"]}>
            <div
              className={styles["visual"] + " " + styles["network"]}
              role="img"
              aria-label="Illustrative SMAJ service network: Store, Jobs, Stream, Education, Health and Transport"
            >
              <div className={styles["wire"]}></div>
              <div className={styles["wire"]}></div>
              <div className={styles["wire"]}></div>
              <div className={styles["wire"]}></div>
              <div className={styles["wire"]}></div>
              <div className={styles["wire"]}></div>
              <div
                className={styles["service"] + " " + styles["one"]}
                title="Store"
              >
                🛍️
              </div>
              <div
                className={styles["service"] + " " + styles["two"]}
                title="Jobs"
              >
                💼
              </div>
              <div
                className={styles["service"] + " " + styles["three"]}
                title="Stream"
              >
                🎬
              </div>
              <div
                className={styles["service"] + " " + styles["four"]}
                title="Education"
              >
                📚
              </div>
              <div
                className={styles["service"] + " " + styles["five"]}
                title="Health"
              >
                🩺
              </div>
              <div
                className={styles["service"] + " " + styles["six"]}
                title="Transport"
              >
                🚕
              </div>
              <div className={styles["network-center"]}>
                <BrandLogo className={styles.networkLogo} />
              </div>
            </div>
            <div className={styles["step-copy"]}>
              <div className={styles["step-title"]}>
                <span className={styles["number"]}>2</span>
                <h3>Review and approve</h3>
              </div>
              <p>
                Review the proposed actions and available SMAJ PI HUB services.
                Nothing proceeds without your approval.
              </p>
            </div>
          </article>
          <article className={styles["step"]}>
            <div className={styles["visual"] + " " + styles["results"]}>
              <div className={styles["result-window"]}>
                <div className={styles["result-top"]}>
                  <strong># task-results</strong>
                  <span>✓ Demo complete</span>
                </div>
                <div className={styles["result-body"]}>
                  <div className={styles["msg-head"]}>
                    <BrandLogo className={styles.logo} />
                    <span className={styles["name"]}>SMAJ AI</span>
                    <span className={styles["time"]}>Demo</span>
                  </div>
                  <p>
                    Simulated delegation complete. Your reviewable proof receipt
                    is ready.
                  </p>
                  <span className={styles["proof"]}>
                    PDF + JSON evidence · Demo data
                  </span>
                  <div className={styles["bars"]}>
                    <span
                      className={styles["bar"]}
                      style={{ height: "28%" }}
                    ></span>
                    <span
                      className={styles["bar"]}
                      style={{ height: "52%" }}
                    ></span>
                    <span
                      className={styles["bar"]}
                      style={{ height: "74%" }}
                    ></span>
                    <span
                      className={styles["bar"]}
                      style={{ height: "68%" }}
                    ></span>
                    <span
                      className={styles["bar"]}
                      style={{ height: "43%" }}
                    ></span>
                    <span
                      className={styles["bar"]}
                      style={{ height: "60%" }}
                    ></span>
                    <span
                      className={styles["bar"]}
                      style={{ height: "83%" }}
                    ></span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["step-copy"]}>
              <div className={styles["step-title"]}>
                <span className={styles["number"]}>3</span>
                <h3>Track and verify</h3>
              </div>
              <p>
                Follow the simulated workflow, inspect what happened, and
                download PDF and JSON proof receipts.
              </p>
            </div>
          </article>
          <p className={styles["small-note"]}>
            Visual reference only. Integrations and actions shown may be
            simulated; this page does not connect to live services.
          </p>
        </section>
      </div>
    </div>
  );
}
