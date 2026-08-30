import type { Env } from "./env";
import { handleApiRequest, seedSettingsIfEmpty } from "./router";
import { ensureRefreshStateRows } from "./lib/settings";
import { refreshAllGames } from "./cron/refresh";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      await seedSettingsIfEmpty(env);
      await ensureRefreshStateRows(env.DB);
      return handleApiRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        await seedSettingsIfEmpty(env);
        await ensureRefreshStateRows(env.DB);
        await refreshAllGames(env.DB);
      })()
    );
  }
};
