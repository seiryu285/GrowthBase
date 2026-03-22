import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { SCHEMA_VERSION } from "@growthbase/core";

import type { ServiceAdapter } from "./serviceAdapter";

export function createOfferDiscovery(serviceAdapter: ServiceAdapter) {
  return declareDiscoveryExtension({
    description: serviceAdapter.discovery.description,
    input: serviceAdapter.discovery.input,
    inputSchema: serviceAdapter.offer.inputSchema,
    bodyType: "json",
    output: {
      example: {
        artifactType: serviceAdapter.offer.artifactType,
        deliveryStatus: "DELIVERED",
        receiptId: "receipt_example"
      }
    }
  });
}

export function getCatalog(serviceAdapter: ServiceAdapter) {
  return {
    offers: [serviceAdapter.offer],
    discovery: [
      {
        serviceId: serviceAdapter.serviceId,
        metadata: createOfferDiscovery(serviceAdapter)
      }
    ],
    schemaVersion: SCHEMA_VERSION
  };
}
