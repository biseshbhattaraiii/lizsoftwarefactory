"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

/** Chrome/Edge's Document Picture-in-Picture: an always-on-top window that can hold any HTML. */
interface DocumentPip {
  requestWindow(opts?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}
declare global {
  interface Window {
    documentPictureInPicture?: DocumentPip;
  }
}

const noopSubscribe = () => () => {};

/** Gives the PiP window the page's styles so portalled React content looks identical. */
function prepare(pip: Window, title: string) {
  const doc = pip.document;
  // Relative URLs in copied CSS (fonts) resolve against the PiP document, which has no URL of its own.
  const base = doc.createElement("base");
  base.href = `${location.origin}/`;
  doc.head.append(base);
  doc.title = title;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = doc.createElement("style");
      style.textContent = Array.from(sheet.cssRules, (r) => r.cssText).join("\n");
      doc.head.append(style);
    } catch {
      if (!sheet.href) continue;
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      doc.head.append(link);
    }
  }
  doc.documentElement.className = document.documentElement.className;
  doc.body.className = "pip-body";
}

export function usePip() {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "documentPictureInPicture" in window,
    () => false,
  );
  // The API only exists on https:// pages (and localhost), even in Chrome.
  const insecure = useSyncExternalStore(noopSubscribe, () => !window.isSecureContext, () => false);
  const [win, setWin] = useState<Window | null>(null);

  /** Must be called from a click handler: browsers only open PiP on a user gesture. */
  const open = useCallback(async (size: { width: number; height: number }, title: string) => {
    const api = window.documentPictureInPicture;
    if (!api) return false;
    const pip = await api.requestWindow(size);
    prepare(pip, title);
    pip.addEventListener("pagehide", () => setWin((w) => (w === pip ? null : w)));
    setWin(pip);
    return true;
  }, []);

  const close = useCallback(() => win?.close(), [win]);

  return { supported, insecure, win, open, close };
}
