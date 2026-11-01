"use client";
import "./reference-landing.css";
import BrandLogo from "./BrandLogo";
export default function LandingPage({checking,ssoEnabled,error}:{checking:boolean;ssoEnabled:boolean;error:string}) {
  return <div className="referenceLanding"><header className="nav"><a className="brand" href="/"><BrandLogo className="navLogo"/></a></header><main><section className="hero"><div className="eyebrow">SMAJ AI · VERIFIED DELEGATION</div><h1>Your request.<br/>Your approval.<br/>Verifiable results.</h1><p>Plan with Meta AI, search connected SMAJ PI HUB services and review actions before they run.</p>{checking?<p role="status">Checking your session…</p>:<><p>Sign in with Pi to continue.</p><a className="pill" href={ssoEnabled?"/api/auth/sso":"https://smajpihub.com/ai"}>Continue with SMAJ PI HUB</a></>}{error&&<p role="alert">{error}</p>}</section></main></div>;
}
