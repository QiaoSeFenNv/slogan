/**
 * Theme definitions for the slime MVP.
 * Three pure-color themes — sakura, mist, lavender.
 *
 * `primary`    — main surface color (center of radial gradient)
 * `secondary`  — mid-outer gradient color
 * `highlight`  — surface specular / gloss color
 * `shadow`     — outer edge / depth color
 * `name`       — display name (zh-CN)
 */
export const themes = {
  sakura: {
    name: '樱花粉',
    primary: '#FFB6C1',
    secondary: '#FF8FAB',
    highlight: '#FFFFFF',
    shadow: '#E68A9E',
  },
  mist: {
    name: '雾霭蓝',
    primary: '#B0E0E6',
    secondary: '#87CEEB',
    highlight: '#FFFFFF',
    shadow: '#7FB8C4',
  },
  lavender: {
    name: '薰衣草',
    primary: '#E6E6FA',
    secondary: '#C8A2C8',
    highlight: '#FFFFFF',
    shadow: '#9F8FB0',
  },
}