import { verifyTypedData } from "viem";
import { BAZAAR, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type FacilitatorClient,
  type RoutesConfig
} from "@x402/core/server";
import { ExactEvmScheme, registerExactEvmScheme } from "@x402/evm/exact/server";

import { createErrorEnvelope, hashCanonicalValue, type ServiceOffer } from "@growthbase/core";

import type { ApiEnv } from "../env";
import { createOfferDiscovery } from "./catalog";
import type { ServiceAdapter } from "./serviceAdapter";

const transferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" }
  ]
} as const;

type AuthorizationPayload = {
  authorization?: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: `0x${string}`;
  };
  signature?: `0x${string}`;
};

class LocalFacilitatorClient implements FacilitatorClient {
  constructor(private readonly env: ApiEnv) {}

  async verify(paymentPayload: any, paymentRequirements: any) {
    const payload = paymentPayload.payload as AuthorizationPayload;
    const authorization = payload.authorization;
    const signature = payload.signature;

    if (!authorization || !signature) {
      return {
        isValid: false,
        invalidReason: "missing_authorization",
        invalidMessage: "Missing EIP-3009 authorization payload."
      };
    }

    const chainId = Number(paymentRequirements.network.split(":")[1]);
    const domainName = String(paymentRequirements.extra?.name ?? "");
    const domainVersion = String(paymentRequirements.extra?.version ?? "");
    const now = Math.floor(Date.now() / 1000);

    if (!domainName || !domainVersion) {
      return {
        isValid: false,
        invalidReason: "missing_domain_metadata",
        invalidMessage: "Payment requirements are missing token domain metadata."
      };
    }

    const isSignatureValid = await verifyTypedData({
      address: authorization.from,
      domain: {
        name: domainName,
        version: domainVersion,
        chainId,
        verifyingContract: paymentRequirements.asset
      },
      types: transferWithAuthorizationTypes,
      primaryType: "TransferWithAuthorization",
      message: {
        from: authorization.from,
        to: authorization.to,
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce
      },
      signature
    });

    const isShapeValid =
      authorization.to.toLowerCase() === String(paymentRequirements.payTo).toLowerCase() &&
      authorization.value === paymentRequirements.amount &&
      now >= Number(authorization.validAfter) &&
      now <= Number(authorization.validBefore);

    if (!isSignatureValid || !isShapeValid) {
      return {
        isValid: false,
        invalidReason: "authorization_invalid",
        invalidMessage: "The payment authorization did not match the request requirements.",
        payer: authorization.from
      };
    }

    return {
      isValid: true,
      payer: authorization.from
    };
  }

  async settle(paymentPayload: any, paymentRequirements: any) {
    const verification = await this.verify(paymentPayload, paymentRequirements);

    if (!verification.isValid) {
      return {
        success: false,
        errorReason: "authorization_invalid",
        errorMessage: verification.invalidMessage,
        payer: verification.payer,
        transaction: "0x0",
        network: this.env.x402Network as `${string}:${string}`
      };
    }

    return {
      success: true,
      payer: verification.payer,
      transaction: hashCanonicalValue({
        accepted: paymentPayload.accepted,
        payload: paymentPayload.payload
      }),
      network: this.env.x402Network as `${string}:${string}`,
      extensions: {
        localSettlement: {
          mode: "deterministic-local"
        }
      }
    };
  }

  async getSupported() {
    return {
      kinds: [
        {
          x402Version: 2,
          scheme: "exact",
          network: this.env.x402Network as `${string}:${string}`
        }
      ],
      extensions: [String(BAZAAR)],
      signers: {
        [this.env.x402Network]: [this.env.x402PayTo]
      }
    };
  }
}

export function assertCompatiblePaymentConfig(env: ApiEnv, offer: ServiceOffer) {
  if (env.x402Network !== offer.network) {
    throw new Error(
      `X402_NETWORK (${env.x402Network}) must match offer.network (${offer.network}) so /purchase and /offers advertise the same settlement network.`
    );
  }
}

export function formatAtomicUsdcPriceForX402(priceAtomic: string): string {
  if (!/^\d+$/.test(priceAtomic)) {
    throw new Error(`Expected atomic price string, received: ${priceAtomic}`);
  }

  const decimals = 6;
  const padded = priceAtomic.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals).replace(/^0+(?=\d)/, "");
  const fractional = padded.slice(-decimals).replace(/0+$/, "");

  return fractional ? `${whole}.${fractional}` : whole;
}

async function createChallengeAccepts(env: ApiEnv, offer: ServiceOffer) {
  const formattedX402Price = formatAtomicUsdcPriceForX402(offer.price);
  const parsedPrice = await new ExactEvmScheme().parsePrice(formattedX402Price, env.x402Network);

  console.info(
    "X402_CHALLENGE_DEBUG",
    JSON.stringify({
      serviceId: offer.serviceId,
      rawOfferPrice: offer.price,
      formattedX402Price,
      network: env.x402Network,
      asset: parsedPrice.asset,
      payTo: env.x402PayTo
    })
  );

  return {
    scheme: "exact" as const,
    payTo: env.x402PayTo,
    price: formattedX402Price,
    network: env.x402Network as `${string}:${string}`,
    maxTimeoutSeconds: 60
  };
}

export async function createPaymentServer(env: ApiEnv, serviceAdapter: ServiceAdapter) {
  const offer = serviceAdapter.offer;
  assertCompatiblePaymentConfig(env, offer);
  const accepts = await createChallengeAccepts(env, offer);
  const facilitator =
    env.x402Mode === "live"
      ? new HTTPFacilitatorClient({ url: env.x402FacilitatorUrl })
      : new LocalFacilitatorClient(env);

  const resourceServer = new x402ResourceServer(facilitator);
  registerExactEvmScheme(resourceServer, { networks: [env.x402Network] });
  resourceServer.registerExtension(bazaarResourceServerExtension);

  const routes: RoutesConfig = {
    [`POST /purchase/${offer.serviceId}`]: {
      accepts,
      resource: `${env.apiBaseUrl}/purchase/${offer.serviceId}`,
      description: "Purchase one deterministic Polymarket hidden-edge scan.",
      mimeType: "application/json",
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: createErrorEnvelope("PAYMENT_REQUIRED", "Payment is required before delivery.", {
          serviceId: offer.serviceId,
          purchaseSpecUrl: `${env.apiBaseUrl}/purchase/${offer.serviceId}`,
          requiredBodyFields: ["policy", "agentIdentity", "input"],
          openPayerDefault: true
        })
      }),
      settlementFailedResponseBody: (_context, settleResult) => ({
        contentType: "application/json",
        body: createErrorEnvelope("PAYMENT_FAILED", "Payment settlement failed.", {
          errorReason: settleResult.errorReason
        })
      }),
      extensions: createOfferDiscovery(serviceAdapter)
    }
  };

  const httpServer = new x402HTTPResourceServer(resourceServer, routes);

  try {
    await httpServer.initialize();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to initialize x402 payment server for X402_MODE=${env.x402Mode}, X402_NETWORK=${env.x402Network}, offer.network=${offer.network}, X402_FACILITATOR_URL=${env.x402FacilitatorUrl}. ${message}`
    );
  }

  return {
    facilitator,
    resourceServer,
    httpServer
  };
}
