/// Color roles used across MemoStack's UI, as light and dark palettes.
export interface Palette {
  pageBackground: string;
  cardBackground: string;
  /// Soft filled surface for list rows and cards that sit on the page
  /// (the borderless grey tiles of the Brightspot-style layout).
  tileBackground: string;
  divider: string;
  accent: string;
  tagSubjectFill: string;
  tagSubjectText: string;
  tagUniversityFill: string;
  tagUniversityText: string;
  tagOfflineFill: string;
  tagOfflineText: string;
  success: string;
  danger: string;
  textPrimary: string;
  textSecondary: string;
  snackBackground: string;
}

export const lightPalette: Palette = {
  pageBackground: '#FFFFFF',
  cardBackground: '#FFFFFF',
  tileBackground: '#F1F3F7',
  divider: '#E4E7EE',
  accent: '#2F7BF5',
  tagSubjectFill: '#E6EFFE',
  tagSubjectText: '#2F7BF5',
  tagUniversityFill: '#EEF0F5',
  tagUniversityText: '#4B5566',
  tagOfflineFill: '#E3F7EC',
  tagOfflineText: '#1F9D55',
  success: '#1F9D55',
  danger: '#E24B5A',
  textPrimary: '#12162B',
  textSecondary: '#6B7280',
  snackBackground: '#12162B',
};

export const darkPalette: Palette = {
  pageBackground: '#0F1729',
  cardBackground: '#1B2540',
  tileBackground: '#18213A',
  divider: '#2A3555',
  accent: '#4C8DFF',
  tagSubjectFill: '#223259',
  tagSubjectText: '#7FB0FF',
  tagUniversityFill: '#232B45',
  tagUniversityText: '#B7BFD9',
  tagOfflineFill: '#1B3A2C',
  tagOfflineText: '#4CD787',
  success: '#4CD787',
  danger: '#FF6B7A',
  textPrimary: '#F5F7FF',
  textSecondary: '#9AA3BE',
  snackBackground: '#223259',
};
