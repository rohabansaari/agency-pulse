export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ap-theme";

/**
 * Runs before first paint (inlined in the root layout) so the page never
 * flashes the wrong theme: a saved choice wins, otherwise the system setting.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t}catch(e){}})();`;
