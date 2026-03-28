import React, { useState, useRef, useContext, createContext, useEffect } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";

// shared mouse position
const MouseContext = createContext({ x: 0, y: 0 });

// SVG icons
const GithubIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

const LinkedinIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const TwitterIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const MailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

// individual icon with magnetic effect
function DockIcon({ icon, href }) {
  const ref = useRef(null);
  const mouse = useContext(MouseContext);
  const distance = useMotionValue(Infinity);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!ref.current || mouse.x === 0) {
      distance.set(Infinity);
      return;
    }
    const iconRect = ref.current.getBoundingClientRect();
    const containerRect = ref.current.parentElement.getBoundingClientRect();
    const iconCenterX = iconRect.left + iconRect.width / 2;
    const mouseXAbsolute = containerRect.left + mouse.x;
    distance.set(Math.abs(mouseXAbsolute - iconCenterX));
  }, [mouse, distance]);

  const width = useTransform(distance, [0, 80], [60, 44]);
  const springW = useSpring(width, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      ref={ref}
      style={{ 
        width: springW,
        height: springW,
        aspectRatio: '1/1',
        borderRadius: '50%',
        backgroundColor: hovered ? 'var(--card)' : 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        color: hovered ? '#fff' : 'var(--text-3)',
        boxShadow: hovered ? '0 4px 12px rgba(108, 92, 231, 0.4)' : 'none',
        transition: 'background-color 0.2s, color 0.2s, box-shadow 0.2s',
        marginBottom: '4px' // Padding from the bottom of the translucent base
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon}
    </motion.a>
  );
}

// main dock
export function MagneticDock() {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onMouseMove = e => {
    const { clientX, currentTarget } = e;
    const { left } = currentTarget.getBoundingClientRect();
    setPos({ x: clientX - left, y: 0 });
  };

  const onMouseLeave = () => {
    setPos({ x: 0, y: 0 });
  };

  return (
    <MouseContext.Provider value={pos}>
      <div style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 50
      }}>
        <div
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={{
            display: 'flex',
            height: '74px',
            alignItems: 'flex-end',
            gap: '12px',
            borderRadius: '24px',
            backgroundColor: 'rgba(12, 12, 20, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--border)',
            padding: '0 16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}
        >
          <DockIcon href="https://linkedin.com/in/faizaniqbal52" icon={<LinkedinIcon />} />
          <DockIcon href="https://github.com/faizaniqbal52" icon={<GithubIcon />} />
          <DockIcon href="https://x.com/faizaniqbal__52" icon={<TwitterIcon />} />
          <DockIcon href="mailto:faizan041@gmail.com" icon={<MailIcon />} />
        </div>
      </div>
    </MouseContext.Provider>
  );
}
