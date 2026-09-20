import "server-only";
import webpush from "web-push";
import type { PushProvider, SendResult } from "./types";

/** Web Push over the standard protocol with VAPID keys: no vendor and no per-message cost. */
export function createWebPushProvider(opts: { publicKey: string; privateKey: string; subject: string }): PushProvider {
  webpush.setVapidDetails(opts.subject, opts.publicKey, opts.privateKey);
  return {
    name: "webpush",
    async send({ subscription, title, body, url }): Promise<SendResult & { gone?: boolean }> {
      try {
        const res = await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify({ title, body, url }),
          { TTL: 60 * 60 * 12 }
        );
        return { ok: true, providerRef: `webpush:${res.statusCode}` };
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        const message = err instanceof Error ? err.message : String(err);
        if (status === 404 || status === 410) return { ok: false, error: message, permanent: true, gone: true };
        return { ok: false, error: message, permanent: status !== undefined && status >= 400 && status < 500 && status !== 429 };
      }
    },
  };
}
