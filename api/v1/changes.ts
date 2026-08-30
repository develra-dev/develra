import {
  changesResponse,
  type RegistryRequest,
} from "../../registry-server/index.js";

export function GET(request: unknown): Response {
  return changesResponse(request as RegistryRequest);
}
