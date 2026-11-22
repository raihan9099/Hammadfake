// theme.js
module.exports = {
  colors: {
    // Facebook's actual neutral palette
    primary: '#1877F2',      // FB blue (only for links/active)
    secondary: '#166FE5',
    accent: '#1877F2',
    danger: '#FA383E',
    success: '#42B72A',
    warning: '#F7B928',
    dark: '#1C1E21',
    light: '#F0F2F5',        // FB page background
    white: '#FFFFFF',
    card: '#FFFFFF',
    hover: '#F2F2F2',
    textPrimary: '#1C1E21',  // FB primary text
    textSecondary: '#65676B',// FB secondary text
    textMuted: '#8A8D91',    // FB muted
    border: '#CED0D4',       // FB divider
    borderLight: '#E4E6EB',
    divider: '#E4E6EB',
    inputBg: '#F0F2F5',
    inputBorder: '#CED0D4',
    overlay: 'rgba(0,0,0,0.5)',
    // Legacy aliases so old rules don't break
    textPrimaryOld: '#333',
    textSecondaryOld: '#666',
    textMutedOld: '#888',
    borderLightOld: '#f0f0f0'
  },

  gradients: {
    // Facebook has no gradients — keep flat colors
    primary: '#1877F2',
    pink: '#FA383E',
    success: '#42B72A',
    danger: '#FA383E',
    background: '#F0F2F5',
    subtlePrimary: 'rgba(24,119,242,0.1)'
  },

  shadows: {
    // Facebook's flat, minimal shadows
    sm: '0 1px 2px rgba(0,0,0,0.1)',
    md: '0 1px 2px rgba(0,0,0,0.1)',
    lg: '0 2px 12px rgba(0,0,0,0.2)',
    primary: '0 1px 2px rgba(0,0,0,0.1)',
    danger: '0 1px 2px rgba(0,0,0,0.1)',
    success: '0 1px 2px rgba(0,0,0,0.1)',
    glow: 'none',
    none: 'none'
  },

  radius: {
    sm: '6px',    // FB uses 6px
    md: '8px',
    lg: '8px',
    xl: '12px',
    pill: '999px',// FB pill buttons
    round: '50%'
  },

  button: {
    paddingY: '8px',
    paddingX: '16px',
    fontSize: '15px',
    fontWeight: '600',
    lift: '0',
    hoverScale: '1',
    activeScale: '0.98',
    transition: 'background-color 0.15s ease, color 0.15s ease'
  },

  body: {
    background: '#F0F2F5',   // FB page bg
    backgroundSize: 'auto',
    animation: 'none'
  },

  card: {
    background: '#FFFFFF',
    backdropBlur: 'none',
    hoverLift: '0',
    border: '1px solid #E4E6EB'
  },

  // Facebook font stack — exact match
  typography: {
    fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI Historic", "Segoe UI", Helvetica, Arial, sans-serif`,
    // Facebook doesn't use Inter — it uses system fonts
    sizeBase: '15px',
    sizeSmall: '13px',
    sizeLarge: '17px',
    sizeH1: '24px',
    sizeH2: '20px',
    sizeH3: '17px',
    lineHeight: '1.3333',
    weightNormal: '400',
    weightMedium: '500',
    weightSemiBold: '600',
    weightBold: '700'
  }
};
