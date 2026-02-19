'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-center"
      offset={96}
      style={
        {
          '--normal-bg': 'var(--surface-elevated)',
          '--normal-text': 'var(--text-primary)',
          '--normal-border': 'var(--glass-border)',
          '--border-radius': '12px',
          '--success-bg': 'var(--surface-elevated)',
          '--success-text': 'var(--spotify-green)',
          '--success-border': 'var(--glass-border)',
          '--error-bg': 'var(--surface-elevated)',
          '--error-text': 'var(--danger)',
          '--error-border': 'var(--glass-border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
