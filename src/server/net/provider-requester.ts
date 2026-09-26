import "server-only";
import { serverEnv } from "../env";
import { createSafeRequester, type HttpRequester } from "./safe-request";

/** Requester usado para falar com provedores configurados pelos clientes. */
export function providerRequester(): HttpRequester {
  return createSafeRequester({ allowPrivateNetwork: serverEnv().SUPORTFY_DEV_ALLOW_PRIVATE_PROVIDER_URLS });
}

export function providerUrlOptions() {
  return { allowPrivateNetwork: serverEnv().SUPORTFY_DEV_ALLOW_PRIVATE_PROVIDER_URLS };
}
