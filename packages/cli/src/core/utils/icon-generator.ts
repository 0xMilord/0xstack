/**
 * Generate SVG app icon with 3D-style initial and shadow
 * Uses brand color from theme + first letter of app name
 */
export function generateAppIcon(appName: string, theme: string = "default") {
  const initial = appName.charAt(0).toUpperCase();
  
  // Theme colors
  const colors: Record<string, { bg: string; gradient1: string; gradient2: string }> = {
    default: { bg: "#000000", gradient1: "#667eea", gradient2: "#764ba2" },
    "corporate-blue": { bg: "#1e3a5f", gradient1: "#4a90d9", gradient2: "#357abd" },
    amber: { bg: "#78350f", gradient1: "#f59e0b", gradient2: "#d97706" },
    grass: { bg: "#14532d", gradient1: "#22c55e", gradient2: "#16a34a" },
  };
  
  const themeColors = colors[theme] || colors.default;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradient for background -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${themeColors?.gradient1 || '#667eea'};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${themeColors?.gradient2 || '#764ba2'};stop-opacity:1" />
    </linearGradient>
    
    <!-- Shadow filter for 3D effect -->
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-opacity="0.4"/>
    </filter>
    
    <!-- Inner shadow for depth -->
    <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
      <feOffset in="blur" dx="0" dy="2" result="offsetBlur"/>
      <feSpecularLighting in="blur" surfaceScale="5" specularConstant=".75" specularExponent="20" lighting-color="#ffffff" result="specOut">
        <fePointLight x="-5000" y="-10000" z="20000"/>
      </feSpecularLighting>
      <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut"/>
      <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litPaint"/>
    </filter>
  </defs>
  
  <!-- Background rounded square -->
  <rect x="0" y="0" width="512" height="512" rx="120" fill="url(#bgGradient)"/>
  
  <!-- Inner border highlight -->
  <rect x="8" y="8" width="496" height="496" rx="112" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
  
  <!-- 3D Initial letter -->
  <text 
    x="50%" 
    y="52%" 
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
    font-size="280" 
    font-weight="800" 
    fill="#ffffff" 
    text-anchor="middle" 
    dominant-baseline="central"
    filter="url(#shadow)"
    style="letter-spacing: -8px;"
  >${initial}</text>
  
  <!-- Highlight overlay for glossy effect -->
  <ellipse cx="380" cy="140" rx="80" ry="50" fill="rgba(255,255,255,0.15)" transform="rotate(-30 380 140)"/>
</svg>`;
}

/**
 * Generate simple favicon (16x16, 32x32) as ICO data URL
 * For simplicity, returns a colored square with initial
 */
export function generateFaviconDataUrl(appName: string, theme: string = "default"): string {
  const initial = appName.charAt(0).toUpperCase();
  const colors: Record<string, string> = {
    default: "#000000",
    "corporate-blue": "#1e3a5f",
    amber: "#78350f",
    grass: "#14532d",
  };
  
  const bgColor = colors[theme] || colors.default;
  
  // Simple SVG favicon
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="${bgColor}"/>
      <text x="50%" y="50%" font-family="system-ui" font-size="20" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">${initial}</text>
    </svg>
  `.trim();
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
