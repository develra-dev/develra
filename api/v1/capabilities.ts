import {
  capabilitiesResponse,
  type RegistryRequest,
} from "../../registry-server/index.js";

export function GET(request: unknown): Response {
  return capabilitiesResponse(request as RegistryRequest);
}
