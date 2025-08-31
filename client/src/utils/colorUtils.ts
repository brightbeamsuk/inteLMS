// Color utility functions for theme customization

/**
 * Convert hex color to HSL
 */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number, s: number, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Convert HSL to hex color
 */
export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate a darker shade of a color for hover states
 */
export function darkerShade(hex: string, amount: number = 15): string {
  const [h, s, l] = hexToHsl(hex);
  const newL = Math.max(0, l - amount);
  return hslToHex(h, s, newL);
}

/**
 * Generate a lighter shade of a color
 */
export function lighterShade(hex: string, amount: number = 15): string {
  const [h, s, l] = hexToHsl(hex);
  const newL = Math.min(100, l + amount);
  return hslToHex(h, s, newL);
}

/**
 * Generate complementary colors based on a primary color
 */
export function generateColorPalette(primaryHex: string) {
  const [h, s, l] = hexToHsl(primaryHex);
  
  // Generate secondary color (analogous - 30 degrees shift)
  const secondaryH = (h + 30) % 360;
  const secondary = hslToHex(secondaryH, Math.max(30, s - 10), Math.min(70, l + 5));
  
  // Generate accent color (complementary - 180 degrees shift with adjusted saturation)
  const accentH = (h + 180) % 360;
  const accent = hslToHex(accentH, Math.max(40, s - 20), Math.min(60, l - 5));
  
  // Generate neutral color (desaturated version)
  const neutral = hslToHex(h, Math.max(10, s - 40), Math.min(80, l + 10));
  
  return {
    primary: primaryHex,
    primaryHover: darkerShade(primaryHex, 10),
    secondary: secondary,
    secondaryHover: darkerShade(secondary, 10),
    accent: accent,
    accentHover: darkerShade(accent, 10),
    neutral: neutral,
    neutralHover: darkerShade(neutral, 10),
  };
}

/**
 * Apply custom color palette to CSS custom properties
 */
export function applyColorPalette(colors: ReturnType<typeof generateColorPalette>) {
  const root = document.documentElement;
  
  // Apply primary colors
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-primary-hover', colors.primaryHover);
  
  // Apply secondary colors  
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty('--color-secondary-hover', colors.secondaryHover);
  
  // Apply accent colors
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-accent-hover', colors.accentHover);
  
  // Apply neutral colors
  root.style.setProperty('--color-neutral', colors.neutral);
  root.style.setProperty('--color-neutral-hover', colors.neutralHover);
}

/**
 * Remove custom color palette and restore defaults
 */
export function removeColorPalette() {
  const root = document.documentElement;
  const properties = [
    '--color-primary', '--color-primary-hover',
    '--color-secondary', '--color-secondary-hover', 
    '--color-accent', '--color-accent-hover',
    '--color-neutral', '--color-neutral-hover'
  ];
  
  properties.forEach(prop => {
    root.style.removeProperty(prop);
  });
}