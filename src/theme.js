// ── Typography ────────────────────────────────────────────────────────────────
// Inter font family — matches the web frontend
export const font = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
};

// ── Colors ────────────────────────────────────────────────────────────────────
// Design token system — mirrors the web frontend CSS variables
export const colors = {
  // Primary
  primary: '#007AFF',
  primaryHover: '#0056CC',
  primaryLight: '#E5F2FF',
  secondary: '#5856D6',

  // Semantic
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#5AC8FA',

  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F5F5F7',
  bgTertiary: '#E8E8ED',

  // Text
  textPrimary: '#1D1D1F',
  textSecondary: '#86868B',
  textTertiary: '#AEAEB2',

  // Borders
  border: '#D2D2D7',
  borderLight: '#E5E5EA',

  // Chat bubbles
  bubbleOwn: '#007AFF',
  bubbleOther: '#FFFFFF',
  bubbleOwnText: '#FFFFFF',
  bubbleOtherText: '#1D1D1F',

  // Header gradient
  headerGradientStart: '#0056CC',
  headerGradientEnd: '#007AFF',
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 24,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: {width: 0, height: 1},
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
};
