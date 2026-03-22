import type { AgentProfile } from "./profile";

export function generateAgentRegistration(profile: AgentProfile) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: profile.name,
    description: profile.description,
    image: profile.image,
    services: profile.services,
    x402Support: profile.x402Support,
    active: profile.active,
    registrations: [
      {
        agentId: Number(profile.identity.agentId),
        agentRegistry: profile.identity.agentRegistry
      }
    ],
    supportedTrust: profile.supportedTrust
  };
}
