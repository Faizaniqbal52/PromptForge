import React from 'react';

function GlassFilter() {
  return (
    <svg className="hidden" style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        <filter
          id="container-glass"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          {/* Generate turbulent noise for distortion */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          {/* Blur the turbulence pattern slightly */}
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          {/* Displace the source graphic with the noise */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          {/* Apply overall blur on the final result */}
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          {/* Output the result */}
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

export function LiquidButton({ children, className, disabled, ...props }) {
  return (
    <button
      className={`liquid-button ${className || ''}`}
      disabled={disabled}
      {...props}
    >
      <div className="liquid-glass-rim" />
      <div 
        className="liquid-glass-backdrop" 
        style={{ backdropFilter: 'url("#container-glass")' }} 
      />
      <div className="liquid-glass-content">
        {children}
      </div>
      <GlassFilter />
    </button>
  );
}
