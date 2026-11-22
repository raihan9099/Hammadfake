// theme.js
module.exports = {
  colors: {
    primary: '#18181B',
    secondary: '#27272A',
    accent: '#3B82F6',
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    dark: '#09090B',
    light: '#FAFAFA',
    textPrimary: '#18181B',
    textSecondary: '#52525B',
    textMuted: '#A1A1AA',
    border: '#E4E4E7',
    borderLight: '#F4F4F5'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
    pink: 'linear-gradient(135deg, #EF4444 0%, #F59E0B 100%)',
    success: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
  },
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.04)',
    md: '0 4px 12px rgba(0,0,0,0.06)',
    lg: '0 12px 32px rgba(0,0,0,0.08)',
    primary: '0 4px 12px rgba(59,130,246,0.15)',
    danger: '0 4px 12px rgba(239,68,68,0.15)',
    success: '0 4px 12px rgba(16,185,129,0.15)',
    glow: '0 0 0 3px rgba(59,130,246,0.1)'
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    pill: '999px',
    round: '50%'
  },
  button: {
    paddingY: '8px',
    paddingX: '16px',
    fontSize: '14px',
    fontWeight: '500',
    lift: '0',
    hoverScale: '1',
    activeScale: '0.98',
    transition: 'all 0.15s ease'
  }
};
