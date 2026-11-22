// theme.js
module.exports = {
  colors: {
    primary: '#4A90FF',
    secondary: '#9D6BFF',
    accent: '#4AE3FF',
    danger: '#FF6BCB',
    success: '#4AE3FF',
    warning: '#FFC84A',
    dark: '#0A0E27',
    light: '#0F1535',
    textPrimary: '#FFFFFF',
    textSecondary: '#A8B0D8',
    textMuted: '#6B7394',
    border: 'rgba(120,150,255,0.15)',
    borderLight: 'rgba(120,150,255,0.08)'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #4A90FF 0%, #9D6BFF 100%)',
    pink: 'linear-gradient(135deg, #FF6BCB 0%, #FF4A7A 100%)',
    success: 'linear-gradient(135deg, #4AE3FF 0%, #4A90FF 100%)'
  },
  shadows: {
    sm: '0 2px 8px rgba(0,0,0,0.4)',
    md: '0 8px 24px rgba(0,0,0,0.5)',
    lg: '0 20px 50px rgba(0,0,0,0.6)',
    primary: '0 4px 20px rgba(74,144,255,0.4)',
    danger: '0 4px 20px rgba(255,107,203,0.3)',
    success: '0 4px 20px rgba(74,227,255,0.3)',
    glow: '0 0 30px rgba(74,144,255,0.3)'
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '20px',
    xl: '24px',
    pill: '999px',
    round: '50%'
  },
  button: {
    paddingY: '10px',
    paddingX: '20px',
    fontSize: '14px',
    fontWeight: '600',
    lift: '-2px',
    hoverScale: '1.02',
    activeScale: '0.98',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }
};
