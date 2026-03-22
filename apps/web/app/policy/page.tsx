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
  const [spenderWallet, setSpenderWallet] = useState<`0x${string}` | "">("0x4444444444444444444444444444444444444444");
  const [token, setToken] = useState<`0x${string}` | "">(defaultPolicyForm.token as `0x${string}`);
  const [maxTotalSpend, setMaxTotalSpend] = useState(defaultPolicyForm.maxTotalSpend);
  const [maxPricePerCall, setMaxPricePerCall] = useState(defaultPolicyForm.maxPricePerCall);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + defaultPolicyForm.validForHours * 60 * 60 * 1000).toISOString());
  const [preview, setPreview] = useState<string>("");
  const [signedPolicy, setSignedPolicy] = useState<string>("");
  const [status, setStatus] = useState("Connect a wallet to sign.");

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
    setStatus(`Connected ${address}`);
  }

  async function buildAndSign() {
    if (!window.ethereum || !humanOwner || !agentWallet || !spenderWallet || !token) {
      setStatus("Missing wallet connection or required addresses.");
      return;
    }

    const client = createWalletClient({ transport: custom(window.ethereum) });
    const unsignedPolicy = createPolicyPreview({
      humanOwner,
      agentWallet,
      spenderWallet,
      token,
      maxTotalSpend,
      maxPricePerCall,
      validUntil
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

  return (
    <div className="page">
      <section className="card stack">
        <p className="eyebrow">Human policy signing</p>
        <h2>Create one bounded DelegationPolicy</h2>
        <p className="muted">{status}</p>
        <div className="actions">
          <button className="button" onClick={connectWallet} type="button">
            Connect wallet
          </button>
          <button className="button secondary" onClick={buildAndSign} type="button">
            Build and sign
          </button>
        </div>
      </section>

      <section className="grid two">
        <div className="card stack">
          <label className="label">
            Human owner
            <input value={humanOwner} onChange={(event) => setHumanOwner(event.target.value as `0x${string}`)} />
          </label>
          <label className="label">
            Agent wallet
            <input value={agentWallet} onChange={(event) => setAgentWallet(event.target.value as `0x${string}`)} />
          </label>
          <label className="label">
            Spender wallet
            <input value={spenderWallet} onChange={(event) => setSpenderWallet(event.target.value as `0x${string}`)} />
          </label>
          <label className="label">
            Token
            <input value={token} onChange={(event) => setToken(event.target.value as `0x${string}`)} />
          </label>
          <label className="label">
            Max total spend
            <input value={maxTotalSpend} onChange={(event) => setMaxTotalSpend(event.target.value)} />
          </label>
          <label className="label">
            Max price per call
            <input value={maxPricePerCall} onChange={(event) => setMaxPricePerCall(event.target.value)} />
          </label>
          <label className="label">
            Valid until
            <input value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
          </label>
        </div>

        <div className="stack">
          <div className="card stack">
            <h3>Unsigned preview</h3>
            <pre className="mono">{preview || "Build a preview to inspect the canonical policy object."}</pre>
          </div>
          <div className="card stack">
            <h3>Signed policy</h3>
            <pre className="mono">{signedPolicy || "The signed DelegationPolicy will appear here."}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}
