// Theme catalogue — display metadata for the settings picker.
// The actual applied colors live in theme.css under [data-theme="<id>"];
// the `swatches` here are just a small preview shown in the modal.

export interface Theme {
  id: string
  label: string
  swatches: string[]
}

export const THEMES: Theme[] = [
  { id: 'rg', label: 'Roland Garros', swatches: ['#7c3a1d', '#1f6b3d', '#f2c14e'] },
  { id: 'ao', label: 'Australian Open', swatches: ['#0a2540', '#2ea3f2', '#ffd23c'] },
  { id: 'usopen', label: 'US Open', swatches: ['#10243e', '#5aa0e6', '#ffd400'] },
  { id: 'wimbledon', label: 'Wimbledon', swatches: ['#00492f', '#52297a', '#caa54a'] },
  { id: 'wta', label: 'WTA', swatches: ['#3a1a5c', '#e6007e', '#b98cff'] },
  { id: 'atp', label: 'ATP', swatches: ['#06122b', '#0091ff', '#9fd0ff'] },
]

export const DEFAULT_THEME = 'rg'

export const THEME_IDS: string[] = THEMES.map((t) => t.id)

export function isValidTheme(id: unknown): id is string {
  return typeof id === 'string' && THEME_IDS.includes(id)
}
