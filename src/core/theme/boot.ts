/**
 * Pre-paint theme bootstrap. Server-importable on purpose: the root layout
 * inlines the returned script into <head> so persisted appearance settings
 * apply before first paint and there is no flash of the wrong theme.
 *
 * Keep the keys here in sync with ThemeProvider.
 */
export interface ThemeBootDefaults {
  mode: string;
  hue: number;
  radius: number;
  density: string;
  font: string;
}

export function themeBootScript(d: ThemeBootDefaults): string {
  return `(function(){try{var s=JSON.parse(localStorage.getItem("builder.settings")||localStorage.getItem("polio.settings")||"{}");var v=(s.state&&s.state.values)||{};var m=v["appearance.mode"]||${JSON.stringify(d.mode)};if(m==="system"){m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var e=document.documentElement;e.dataset.theme=m;e.style.setProperty("--accent-h",String(v["appearance.accentHue"]!=null?v["appearance.accentHue"]:${d.hue}));e.style.setProperty("--radius",(v["appearance.radius"]!=null?v["appearance.radius"]:${d.radius})+"px");if(v["appearance.fontScale"]!=null){e.style.setProperty("--font-scale",String(v["appearance.fontScale"]))}e.dataset.density=v["appearance.density"]||${JSON.stringify(d.density)};e.dataset.font=v["appearance.font"]||${JSON.stringify(d.font)};e.dataset.grid=(v["effects.grid"]!==false)?"on":"off";e.dataset.glow=(v["effects.glow"]!==false)?"on":"off";e.dataset.glass=(v["effects.glass"]!==false)?"on":"off";e.dataset.blur=(v["privacy.blur"]===true)?"on":"off";}catch(e){}})();`;
}
