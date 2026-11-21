module.exports = {
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#f093fb',
    danger: '#eb3349',
    success: '#00b09b',
    warning: '#f59e0b',
    dark: '#1a1a2e',
    light: '#f8f9fa',
    textPrimary: '#333',
    textSecondary: '#666',
    textMuted: '#888',
    border: '#e0e0e0',
    borderLight: '#f0f0f0'
  },

  gradients: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    pink: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    success: 'linear-gradient(135deg, #00b09b, #96c93d)',
    danger: 'linear-gradient(135deg, #eb3349, #f45c43)',
    ocean: 'linear-gradient(135deg, #2E3192 0%, #1BFFFF 100%)',
    sunset: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
    candy: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #f8b500 100%)'
  },

  shadows: {
    sm: '0 2px 8px rgba(0,0,0,0.08)',
    md: '0 10px 30px rgba(0,0,0,0.1)',
    lg: '0 20px 50px rgba(0,0,0,0.15)',
    primary: '0 10px 25px rgba(102,126,234,0.4)',
    danger: '0 10px 25px rgba(235,51,73,0.4)',
    success: '0 10px 25px rgba(0,176,155,0.4)',
    glow: '0 0 20px rgba(102,126,234,0.5)'
  },

  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    pill: '25px',
    round: '50%'
  },

  button: {
    paddingY: '14px',
    paddingX: '28px',
    fontSize: '0.95em',
    fontWeight: '700',
    lift: '-3px',
    hoverScale: '1.05',
    activeScale: '0.97',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },

  body: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundSize: '400% 400%',
    animation: 'gradientShift 15s ease infinite'
  },

  card: {
    background: 'rgba(255,255,255,0.95)',
    backdropBlur: '20px',
    hoverLift: '-4px'
  }
};
