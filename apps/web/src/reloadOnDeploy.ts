/**
 * The bar and the big screen stay open all evening, so they pick up a deploy
 * by themselves: every 30s, fetch index.html and compare its script with the
 * one this page is running. If it changed, reload, unless someone is typing.
 * Does nothing on the dev server (no hashed /assets/ script).
 */
export function reloadOnDeploy(): void {
  const running = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src;
  if (!running) return;
  setInterval(async () => {
    try {
      const html = await (await fetch("/", { cache: "no-store" })).text();
      const src = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
      if (!src || new URL(src, location.href).href === running) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      location.reload();
    } catch {
      // Offline or mid-deploy: try again next time.
    }
  }, 30_000);
}
