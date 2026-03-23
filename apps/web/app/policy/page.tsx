"use client";

import { useState } from "react";
import { custom, createWalletClient } from "viem";

import { attachDelegationSignature, delegationPolicyTypedData, getDelegationPolicyDomain, getDelegationPolicyMessage } from "@growthbase/policy";

import { createPolicyPreview, defaultPolicyForm } from "../../lib/policy";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function PolicyPage() {
  const [humanOwner, setHumanOwner] = useState<`0x${string}` | "">("");
  const [agentWallet, setAgentWallet] = useState<`0x${string}` | "">("0x3333333333333333333333333333333333333333");
  const [spenderWallet, setSpenderWallet] = useState<`0x${string}` | "">("");
  const [token, setToken] = useState<`0x${string}` | "">(defaultPolicyForm.token as `0x${string}`);
  const [maxTotalSpend, setMaxTotalSpend] = useState(defaultPolicyForm.maxTotalSpend);
  const [maxPricePerCall, setMaxPricePerCall] = useState(defaultPolicyForm.maxPricePerCall);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + defaultPolicyForm.validForHours * 60 * 60 * 1000).toISOString());
  const [preview, setPreview] = useState<string>("");
  const [signedPolicy, setSignedPolicy] = useState<string>("");
  const [status, setStatus] = useState("Connect a wallet to sign.");
  const [isConnected, setIsConnected] = useState(false);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("No injected wallet detected.");
      return;
    }
    const client = createWalletClient({ transport: custom(window.ethereum) });
    const [address] = await client.requestAddresses();
    if (!address) {
      setStatus("Wallet did not return an address.");
      return;
    }
    setHumanOwner(address);
    setIsConnected(true);
    setStatus(`Connected ${address.slice(0, 6)}...${address.slice(-4)}`);
  }

  async function buildAndSign() {
    if (!window.ethereum || !humanOwner || !agentWallet || !token) {
      setStatus("Missing wallet connection or required addresses.");
      return;
    }
    const client = createWalletClient({ transport: custom(window.ethereum) });
    const unsignedPolicy = createPolicyPreview({
      humanOwner,
      agentWallet,
      spenderWallet: spenderWallet || undefined,
      token,
      maxTotalSpend, maxPricePerCall, validUntil
    });
    setPreview(JSON.stringify(unsignedPolicy, null, 2));

    const signature = await client.signTypedData({
      account: humanOwner,
      domain: getDelegationPolicyDomain(unsignedPolicy.chainId),
      types: delegationPolicyTypedData,
      primaryType: "DelegationPolicy",
      message: getDelegationPolicyMessage(unsignedPolicy)
    });

    const signed = attachDelegationSignature(unsignedPolicy, signature);
    setSignedPolicy(JSON.stringify(signed, null, 2));
    setStatus("DelegationPolicy signed.");
  }

  const fields = [
    { label: "Human owner", value: humanOwner, set: setHumanOwner, mono: true },
    { label: "Agent wallet", value: agentWallet, set: setAgentWallet, mono: true },
    { label: "Spender wallet (optional)", value: spenderWallet, set: setSpenderWallet, mono: true },
    { label: "Token", value: token, set: setToken, mono: true },
    { label: "Max total spend", value: maxTotalSpend, set: setMaxTotalSpend, mono: false },
    { label: "Max price per call", value: maxPricePerCall, set: setMaxPricePerCall, mono: false },
    { label: "Valid until", value: validUntil, set: setValidUntil, mono: false },
  ];

  return (
    <div className="subpage">
      {/* header */}
      <section className="subpage-hero">
        <span className="section-label">DELEGATE</span>
        <h1 className="subpage-title">Create one bounded DelegationPolicy</h1>
        <p className="subpage-subtitle">{status}</p>
        <div className="subpage-actions">
          <button
            className={`btn-primary ${isConnected ? "btn-connected" : ""}`}
            onClick={connectWallet}
            type="button"
          >
            <span className="btn-dot" />
            {isConnected ? "Connected" : "Connect wallet"}
          </button>
          <button className="btn-secondary" onClick={buildAndSign} type="button">
            Build and sign
          </button>
        </div>
      </section>

      {/* form + output */}
      <section className="subpage-grid two">
        <div className="subpage-card">
          <h3 className="card-heading">Policy parameters</h3>
          <div className="field-list">
            {fields.map((f) => (
              <label key={f.label} className="field">
                <span className="field-label">{f.label}</span>
                <input
                  className={`field-input ${f.mono ? "field-mono" : ""}`}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value as any)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="output-stack">
          <div className="subpage-card">
            <div className="card-heading-row">
              <h3 className="card-heading">Unsigned preview</h3>
              {preview && <span className="status-dot status-pending" />}
            </div>
            <pre className="code-block">{preview || "Build a preview to inspect the canonical policy object."}</pre>
          </div>
          <div className="subpage-card">
            <div className="card-heading-row">
              <h3 className="card-heading">Signed policy</h3>
              {signedPolicy && <span className="status-dot status-success" />}
            </div>
            <pre className="code-block">{signedPolicy || "The signed DelegationPolicy will appear here."}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}
