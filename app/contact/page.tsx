import Link from 'next/link';

export default function ContactPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav className="nav">
        <Link href="/" className="nav-brand" style={{ textDecoration: 'none' }}>LoyaltyQR</Link>
      </nav>

      <div className="container" style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1.5rem' }}>Contact Us</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem' }}>
          Have questions, need support, or want to report an issue? We're here to help!
        </p>

        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Get in Touch</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '1.5rem' }}>📧</div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Email Support</div>
                <a href="mailto:loyalltyqr@gmail.com" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: '1.1rem' }}>loyalltyqr@gmail.com</a>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '1.5rem' }}>📞</div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Phone & WhatsApp</div>
                <a href="tel:+919660610690" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: '1.1rem' }}>+91 9660610690</a>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Business Hours</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Monday to Saturday: 10:00 AM - 7:00 PM (IST)<br/>
            Sunday: Closed
          </p>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', fontSize: '0.9rem' }}>
            * For urgent issues regarding active campaigns, please message us on WhatsApp directly.
          </p>
        </div>
      </div>

      <footer style={{ padding: '2rem 1rem', textAlign: 'center', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4rem' }}>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <Link href="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Use</Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <Link href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <Link href="/contact" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Contact Us</Link>
        </div>
        © 2026 LoyaltyQR. Built for Indian businesses with ❤️
      </footer>
    </div>
  );
}
