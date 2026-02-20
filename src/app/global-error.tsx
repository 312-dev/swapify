'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: 'radial-gradient(ellipse at 50% 0%, #0c2a3d 0%, #081420 40%, #0a0a0a 100%)',
          color: '#ffffff',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '0.75rem',
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            color: '#c4c4c4',
            marginBottom: '2rem',
            maxWidth: '20rem',
          }}
        >
          A critical error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            background: '#38BDF8',
            color: '#ffffff',
            border: 'none',
            borderRadius: '9999px',
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
