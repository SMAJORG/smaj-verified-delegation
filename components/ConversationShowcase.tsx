"use client";

import { useEffect, useRef, useState } from "react";
import BrandLogo from "./BrandLogo";
import "./conversation-showcase.css";

export const conversations = [
  { name: "Amina Yusuf", image: 47, question: "find suitable software engineering opportunities on SMAJ PI HUB Jobs.", response: "I found matching opportunities in the sample Jobs data. Here is a plan for you to review before any action.", steps: ["Matching opportunities reviewed", "Action plan prepared", "Awaiting your approval"], title: "Job matching plan" },
  { name: "David Okafor", image: 12, question: "help me compare products on SMAJ Store.", response: "I organized the sample product information and prepared a comparison for your review.", steps: ["Products compared", "Options ranked", "No purchase placed"], title: "Product comparison" },
  { name: "Fatima Bello", image: 44, question: "can you show me proof of what you did?", response: "Absolutely. Here is the record of the simulated delegation, including approvals and outcome checks.", steps: ["Goal and plan recorded", "Human approval tracked", "Mock outcome verified"], title: "Verification receipt · PDF / JSON" },
  { name: "Samuel Ade", image: 15, question: "help me discover entertainment in SMAJ Stream.", response: "I prepared an example discovery list based on your interests. Review the suggestions below.", steps: ["Preferences interpreted", "Example content organized", "No real stream started"], title: "Content discovery" },
  { name: "Zainab Musa", image: 45, question: "what happens if an approved task fails?", response: "The demo records the failure, attempts the configured recovery step, and keeps a traceable log.", steps: ["Failure detected", "Recovery simulated", "Result recorded"], title: "Recovery log" },
  { name: "Ibrahim Ali", image: 13, question: "can you complete a purchase for me?", response: "I can prepare a plan, but this demo does not make real purchases or Pi payments. Your approval remains required.", steps: ["Purchase intent understood", "Approval checkpoint created", "Real payment disabled"], title: "Approval checkpoint" },
  { name: "Grace Mensah", image: 49, question: "summarize the delegation outcome for my team.", response: "Here is a concise summary with the recorded plan, approval status, and simulated outcome.", steps: ["Plan summarized", "Approval status included", "Proof receipt available"], title: "Delegation summary" },
];

export default function ConversationShowcase() {
  const [index, setIndex] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex(current => (current + 1) % conversations.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [index]);

  const conversation = conversations[index];

  return (
    <div className="conversationShowcase" id="features" role="region" aria-label="SMAJ AI animated conversation showcase">
      <div className="conversationFrame">
        <div className="conversationWindow">
          <div className="conversationViewport" ref={viewport}>
            <div className="conversationInner" key={index}>
              <div className="conversationMessage conversationQuestion">
                <img className="conversationAvatar" src={`https://i.pravatar.cc/120?img=${conversation.image}`} alt={`${conversation.name}'s portrait`} width={60} height={60} />
                <div>
                  <div className="conversationPerson"><span className="conversationName">{conversation.name}</span><span className="conversationTime">2:30 PM</span></div>
                  <div className="conversationText"><span className="conversationMention">@SMAJ AI</span> {conversation.question}</div>
                </div>
              </div>
              <div className="conversationMessage">
                <BrandLogo className="conversationAvatar conversationAiAvatar" />
                <div>
                  <div className="conversationPerson"><span className="conversationName">SMAJ AI</span><span className="conversationTime">2:30 PM</span></div>
                  <div className="conversationText">
                    {conversation.response}
                    <div className="conversationReceipt">
                      <div className="conversationReceiptTitle">{conversation.title}</div>
                      {conversation.steps.map(step => <div className="conversationStep" key={step}><span className="conversationCheck">✓</span>{step}</div>)}
                      <div className="conversationProof"><div><strong>Proof record</strong><br /><small>Simulated demonstration</small></div><span className="conversationBadge">MOCK</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="conversationFooter" aria-label={`Conversation ${index + 1} of ${conversations.length}`}>
            <div className="conversationDots" aria-hidden="true">{conversations.map((item, dot) => <span className={`conversationDot${dot === index ? " active" : ""}`} key={item.name} />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
