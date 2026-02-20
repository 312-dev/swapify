'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-center"
      offset={16}
      style={
        {
          '--normal-bg': 'rgba(24, 24, 24, 0.85)',
          '--normal-text': 'var(--text-primary)',
          '--normal-border': 'rgba(255, 255, 255, 0.12)',
          '--border-radius': '16px',
          '--success-bg': 'rgba(24, 24, 24, 0.85)',
          '--success-text': 'var(--accent-green)',
          '--success-border': 'rgba(74, 222, 128, 0.25)',
          '--error-bg': 'rgba(24, 24, 24, 0.85)',
          '--error-text': 'var(--danger)',
          '--error-border': 'rgba(239, 68, 68, 0.25)',
          '--width': '420px',
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          fontSize: '15px',
          lineHeight: '1.4',
          padding: '14px 18px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
