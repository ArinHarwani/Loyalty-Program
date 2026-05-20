'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Scan Page Error:', error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', maxWidth: '400px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Something went wrong!
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          We encountered an unexpected error while loading this page. 
          {error.message && (
            <span style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Details: {error.message}
            </span>
          )}
        </p>
        
        <button
          className="btn btn-primary btn-full"
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
        >
          Try again
        </button>
      </div>
    </div>
  );
}
