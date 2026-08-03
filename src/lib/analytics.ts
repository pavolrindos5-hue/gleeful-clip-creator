export const GA_MEASUREMENT_ID = "G-W3ENZCXYD6";

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

export function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

// gtag.js sa načítava priamo v <head> (src/routes/__root.tsx)
export function initAnalytics() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
}

export function trackPageView(path: string) {
  gtag("event", "page_view", { page_path: path, page_location: window.location.href });
}
