export const styles = `
.devin-bridge { color: inherit; font: inherit; padding-bottom: 12px; }
.devin-bridge h2 { font-size: 21px; line-height: 1.3; margin: 0 0 18px; font-weight: 650; }
.devin-bridge h3 { font-size: 15px; line-height: 1.35; margin: 0; font-weight: 650; }
.devin-bridge p { margin: 6px 0 0; line-height: 1.45; }
.devin-section { border-top: 1px solid color-mix(in srgb, currentColor 16%, transparent); padding: 16px 0; }
.devin-heading, .devin-filter, .devin-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.devin-heading { justify-content: space-between; }
.devin-heading > div:first-child { min-width: 0; }
.devin-bridge button, .devin-bridge input[type=search] { font: inherit; font-size: 13px; color: inherit; border: 1px solid color-mix(in srgb, currentColor 24%, transparent); border-radius: 8px; padding: 7px 10px; background: transparent; }
.devin-bridge button { cursor: pointer; min-height: 34px; }
.devin-bridge button:not(:disabled):hover { background: color-mix(in srgb, currentColor 8%, transparent); }
.devin-bridge button.devin-primary { background: #244ba8; border-color: #244ba8; color: white; }
.devin-bridge button.devin-primary:not(:disabled):hover { background: #1c3d8f; }
.devin-bridge button:disabled { opacity: .48; cursor: default; }
.devin-bridge :focus-visible { outline: 2px solid #567eeb; outline-offset: 2px; }
.devin-bridge a { color: inherit; display: inline-block; margin-top: 9px; text-underline-offset: 3px; font-size: 13px; }
.devin-bridge .devin-note:empty, .devin-bridge .devin-result:empty { display: none; }
.devin-usage { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 16px; margin-top: 12px; font-variant-numeric: tabular-nums; }
.devin-usage progress { width: 100%; height: 9px; accent-color: #446bcb; }
.devin-filter { margin: 12px 0 6px; }
.devin-filter input[type=search] { flex: 1; min-width: 150px; }
.devin-filter label, .devin-model { display: flex; align-items: center; gap: 9px; }
.devin-bridge input[type=checkbox] { accent-color: #446bcb; width: 15px; height: 15px; flex: 0 0 auto; }
.devin-models { max-height: 245px; overflow: auto; overscroll-behavior: contain; }
.devin-model { min-height: 42px; padding: 6px 8px; cursor: pointer; }
.devin-model:hover { background: color-mix(in srgb, currentColor 6%, transparent); }
.devin-model small { display: block; font-size: 11px; opacity: .72; overflow-wrap: anywhere; }
.devin-save { margin-top: 12px; font-size: 13px; }
.devin-error { border-inline-start: 3px solid #bc542a; padding-inline-start: 9px; }
`
