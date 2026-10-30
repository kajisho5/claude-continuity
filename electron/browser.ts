import { session, shell, WebContentsView, type BrowserWindow } from "electron";

/** What the browser panel shows: the page, its title and the navigation buttons' state. */
export type BrowserState = { url: string; title: string; canGoBack: boolean; canGoForward: boolean; loading: boolean; error: string };
export type Bounds = { x: number; y: number; width: number; height: number };

// Pages get their own storage (logins persist), apart from the app's own page.
export const BROWSER_PARTITION = "persist:browser";
const WEB_URL = /^https?:\/\//i;

/** A typed address as a URL: http(s) as is, a bare host gets https://, anything else becomes a web search. */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (WEB_URL.test(text)) {
    try { return new URL(text).href; } catch { return null; }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^\s/:]+:\d+(\/|$)/.test(text)) return null; // other schemes (file:, javascript:)
  if (!/\s/.test(text) && /^(localhost|[\w-]+(\.[\w-]+)+|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(text)) {
    const local = /^(localhost|127\.|\d{1,3}(\.\d{1,3}){3})/.test(text);
    try { return new URL((local ? "http://" : "https://") + text).href; } catch { return null; }
  }
  return "https://duckduckgo.com/?q=" + encodeURIComponent(text);
}

/** Plain text of the page sent to Claude: title, address and the visible text, size-limited. */
export function pageDocument(page: { title: string; url: string; text: string }, max = 200_000): string {
  const text = page.text.replace(/\n{3,}/g, "\n\n").trim();
  return `# ${page.title || page.url}\n\n${page.url}\n\n${text.length > max ? text.slice(0, max) + "\n…" : text}\n`;
}

/** The in-app browser: one page in a WebContentsView laid over the panel's area of the window. */
export class InAppBrowser {
  private view: WebContentsView | null = null;
  private bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 };
  private visible = false;
  private lastError = "";

  private permissionsSet = false;

  constructor(private readonly window: () => BrowserWindow | null, private readonly emit: (state: BrowserState) => void) {}

  /** Pages ask for nothing they could use behind the user's back: camera, microphone, location and the like are refused. */
  private restrictPermissions() {
    if (this.permissionsSet) return;
    this.permissionsSet = true;
    const ses = session.fromPartition(BROWSER_PARTITION);
    const allowed = (permission: string) => permission === "fullscreen" || permission === "clipboard-sanitized-write";
    ses.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed(permission)));
    ses.setPermissionCheckHandler((_wc, permission) => allowed(permission));
  }

  state(): BrowserState {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed()) return { url: "", title: "", canGoBack: false, canGoForward: false, loading: false, error: "" };
    const url = wc.getURL();
    return { url: url === "about:blank" ? "" : url, title: wc.getTitle(), canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward(), loading: wc.isLoading(), error: this.lastError };
  }

  private ensure(): WebContentsView | null {
    const win = this.window();
    if (!win) return null;
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    this.restrictPermissions();
    const view = new WebContentsView({ webPreferences: { partition: BROWSER_PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
    const wc = view.webContents;
    const update = () => this.emit(this.state());
    // Links that open a new window stay in this panel.
    wc.setWindowOpenHandler(({ url }) => {
      if (WEB_URL.test(url)) void wc.loadURL(url);
      return { action: "deny" };
    });
    wc.on("will-navigate", (event, url) => { if (!WEB_URL.test(url)) event.preventDefault(); });
    wc.on("did-start-loading", () => { this.lastError = ""; update(); });
    wc.on("did-stop-loading", update);
    wc.on("did-navigate", update);
    wc.on("did-navigate-in-page", update);
    wc.on("page-title-updated", update);
    wc.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
      // -3 is an aborted load (a new navigation replaced it), not a failure to show.
      if (isMainFrame && code !== -3) { this.lastError = description || String(code); update(); }
    });
    view.setBackgroundColor("#FFFFFF");
    win.contentView.addChildView(view);
    view.setBounds(this.bounds);
    view.setVisible(this.visible);
    this.view = view;
    return view;
  }

  async open(input: string): Promise<BrowserState> {
    const url = normalizeUrl(input);
    if (!url) throw new Error("invalid url");
    const view = this.ensure();
    if (!view) throw new Error("no window");
    this.lastError = "";
    await view.webContents.loadURL(url).catch(() => {}); // a failed load is reported through the state
    return this.state();
  }

  layout(bounds: Bounds, visible: boolean) {
    this.bounds = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.max(0, Math.round(bounds.width)), height: Math.max(0, Math.round(bounds.height)) };
    this.visible = visible && this.bounds.width > 0 && this.bounds.height > 0;
    if (!this.view || this.view.webContents.isDestroyed()) return;
    this.view.setBounds(this.bounds);
    this.view.setVisible(this.visible);
  }

  back() { const h = this.view?.webContents.navigationHistory; if (h?.canGoBack()) h.goBack(); }
  forward() { const h = this.view?.webContents.navigationHistory; if (h?.canGoForward()) h.goForward(); }
  reload() { this.view?.webContents.reload(); }
  stop() { this.view?.webContents.stop(); }

  openExternal() {
    const url = this.state().url;
    if (WEB_URL.test(url)) void shell.openExternal(url);
  }

  async pageText(): Promise<{ title: string; url: string; text: string } | null> {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed() || !this.state().url) return null;
    // Runs in an isolated world: the page's own scripts cannot change what is read here.
    const text = await wc.executeJavaScriptInIsolatedWorld(999, [{ code: "document.body ? document.body.innerText : ''" }]).catch(() => "");
    return { title: wc.getTitle(), url: wc.getURL(), text: String(text ?? "") };
  }

  async capture(): Promise<Buffer | null> {
    const wc = this.view?.webContents;
    if (!wc || wc.isDestroyed() || !this.state().url) return null;
    const image = await wc.capturePage();
    return image.isEmpty() ? null : image.toPNG();
  }

  close() {
    const view = this.view;
    this.view = null;
    this.visible = false;
    this.lastError = "";
    if (!view) return;
    try { this.window()?.contentView.removeChildView(view); } catch { /* the window is already gone */ }
    if (!view.webContents.isDestroyed()) view.webContents.close();
    this.emit(this.state());
  }

  async clearData() {
    await session.fromPartition(BROWSER_PARTITION).clearStorageData();
    await session.fromPartition(BROWSER_PARTITION).clearCache();
  }
}
