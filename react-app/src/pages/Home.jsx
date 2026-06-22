import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Particles from "react-tsparticles"
import { loadFull } from "tsparticles"
import '../styles/home.css'

export default function Home() {
  const hubRef = useRef(null)

  const particlesInit = async (engine) => {
    await loadFull(engine)
  }

  useEffect(() => {
    const cards = document.querySelectorAll('.tool-card')
    const handleMouseMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const glow = e.currentTarget.querySelector('.spotlight-glow')
      if (glow) {
        glow.style.background = `radial-gradient(350px circle at ${x}px ${y}px, rgba(99,102,241,0.08), transparent 70%)`
      }
    }
    cards.forEach(c => c.addEventListener('mousemove', handleMouseMove))

    // Animate KB bar demo
    const kbThumb = document.querySelector('.kb-thumb')
    const kbVal = document.querySelector('.kb-val')
    if (kbThumb && kbVal) {
      let dir = 1, pos = 40
      const ticker = setInterval(() => {
        pos += dir * 0.5
        if (pos > 78 || pos < 18) dir *= -1
        kbThumb.style.left = pos + '%'
        kbVal.textContent = Math.round(60 + pos * 1.8) + ' KB'
      }, 50)
      return () => {
        cards.forEach(c => c.removeEventListener('mousemove', handleMouseMove))
        clearInterval(ticker)
      }
    }
    return () => cards.forEach(c => c.removeEventListener('mousemove', handleMouseMove))
  }, [])

  return (
    <>
      <Navbar />
      
      <Particles
        id="tsparticles"
        init={particlesInit}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: -1 }}
          options={{
            background: {
              color: { value: "transparent" },
            },
            fpsLimit: 120,
            interactivity: {
              events: {
                onClick: { enable: true, mode: "push" },
                onHover: { enable: true, mode: "repulse" },
                resize: true,
              },
              modes: {
                push: { quantity: 4 },
                repulse: { distance: 100, duration: 0.4 },
              },
            },
            particles: {
              color: { value: "#6366f1" },
              links: {
                color: "#6366f1",
                distance: 150,
                enable: true,
                opacity: 0.3,
                width: 1,
              },
              move: {
                direction: "none",
                enable: true,
                outModes: { default: "bounce" },
                random: false,
                speed: 1,
                straight: false,
              },
              number: {
                density: { enable: true, area: 800 },
                value: 60,
              },
              opacity: { value: 0.5 },
              shape: { type: "circle" },
              size: { value: { min: 1, max: 3 } },
            },
            detectRetina: true,
          }}
        />

      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      <main className="hub-container" ref={hubRef}>

        {/* ── Hero ── */}
        <section className="hero animate-fade-in">
          <div className="hero-badge">
            <i className="ph ph-shield-check"></i>
            Secure · On-Device · Zero Data Sharing
          </div>
          <h1>
            Your Documents,<br />
            <span className="gradient-text">Handled Right.</span>
          </h1>
          <p>
            Amrit Enterprises brings you a suite of smart document utilities — built entirely
            for your browser. No servers involved, no sign-ups, no hidden charges.
            What stays on your device, <strong>stays yours.</strong>
          </p>

          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-value">0</span>
              <span className="stat-label">Data Uploaded</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">50+</span>
              <span className="stat-label">Size Presets</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">₹0</span>
              <span className="stat-label">Cost to You</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">5</span>
              <span className="stat-label">Output Formats</span>
            </div>
          </div>
        </section>

        {/* ── Tool Cards ── */}
        <div className="tool-grid" style={{ marginTop: '0.5rem' }}>

          {/* Photo Studio */}
          <Link to="/passport-photo" className="tool-card animate-up" id="card-passport">
            <div className="spotlight-glow"></div>
            <span className="tool-card-badge">
              <i className="ph ph-sparkle"></i> AI-Powered
            </span>
            <div className="tool-card-content">
              <div className="tool-card-visual" id="passport-visual">
                <div className="tool-card-visual-inner passport-preview">
                  <div className="passport-photo-grid">
                    <div className="pp-slot filled"><i className="ph ph-user"></i></div>
                    <div className="pp-slot filled"><i className="ph ph-user"></i></div>
                    <div className="pp-slot filled ai-glow"><i className="ph ph-user"></i></div>
                    <div className="pp-slot"><i className="ph ph-plus"></i></div>
                  </div>
                  <div className="pp-badge-row">
                    <span className="pp-badge">3×4 cm</span>
                    <span className="pp-badge">3.5×4.5</span>
                    <span className="pp-badge">2×2"</span>
                  </div>
                  <div className="pp-ai-bar">
                    <i className="ph ph-cpu"></i>
                    <div className="pp-ai-progress"><div className="pp-ai-fill"></div></div>
                    <span>Removing Background…</span>
                  </div>
                </div>
              </div>
              <div className="tool-info">
                <h2>Passport Photo Studio</h2>
                <p>
                  Instantly generate government-compliant passport and visa photos right in
                  your browser. Our on-device AI detects and replaces backgrounds — no
                  studio visit, no waiting.
                </p>
              </div>
              <div className="feature-tags">
                <span className="feature-tag">On-Device AI</span>
                <span className="feature-tag">PDF Sheet Export</span>
                <span className="feature-tag">50+ Country Sizes</span>
              </div>
            </div>
            <div className="btn-arrow">Launch Studio <i className="ph ph-arrow-right"></i></div>
          </Link>

          {/* File Toolkit */}
          <Link to="/file-converter" className="tool-card animate-up" id="card-converter">
            <div className="spotlight-glow"></div>
            <span className="tool-card-badge">
              <i className="ph ph-wifi-slash"></i> Works Offline
            </span>
            <div className="tool-card-content">
              <div className="tool-card-visual">
                <div className="tool-card-visual-inner converter-preview">
                  <div className="converter-formats">
                    <div className="fmt-pill jpg">JPG</div>
                    <i className="ph ph-arrow-right fmt-arrow"></i>
                    <div className="fmt-pill png">PNG</div>
                    <i className="ph ph-arrow-right fmt-arrow"></i>
                    <div className="fmt-pill webp">WEBP</div>
                  </div>
                  <div className="converter-formats" style={{ marginTop: '0.5rem' }}>
                    <div className="fmt-pill pdf">PDF</div>
                    <i className="ph ph-arrow-right fmt-arrow"></i>
                    <div className="fmt-pill jpg">JPG</div>
                  </div>
                  <div className="kb-control">
                    <span className="kb-label"><i className="ph ph-faders-horizontal"></i> Precise Target Size</span>
                    <div className="kb-bar">
                      <div className="kb-track"><div className="kb-thumb"></div></div>
                      <span className="kb-val">150 KB</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="tool-info">
                <h2>Image &amp; File Toolkit</h2>
                <p>
                  Convert between JPG, PNG, WEBP, GIF, and PDF in seconds. Unique
                  KB-targeting lets you hit an exact file size — perfect for
                  document portals with upload limits.
                </p>
              </div>
              <div className="feature-tags">
                <span className="feature-tag">KB Size Targeting</span>
                <span className="feature-tag">Batch Processing</span>
                <span className="feature-tag">PDF Conversion</span>
              </div>
            </div>
            <div className="btn-arrow">Open Toolkit <i className="ph ph-arrow-right"></i></div>
          </Link>

          {/* Card Layout Studio */}
          <Link to="/id-card-printer" className="tool-card animate-up" id="card-idprinter">
            <div className="spotlight-glow"></div>
            <span className="tool-card-badge">
              <i className="ph ph-printer"></i> Print-Ready Layout
            </span>
            <div className="tool-card-content">
              <div className="tool-card-visual">
                <div className="tool-card-visual-inner idcard-preview">
                  <div className="idcard-mock-grid">
                    <div className="idcard-mock-slot filled">
                      <div className="mock-card-face">
                        <div className="mock-card-header">
                          <div className="mock-avatar"></div>
                          <div className="mock-lines">
                            <div className="mock-line-title"></div>
                            <div className="mock-line-sub"></div>
                          </div>
                        </div>
                        <div className="mock-card-barcode"></div>
                        <span className="face-lbl">FRONT</span>
                      </div>
                      <div className="mock-crop-mark tl"></div>
                      <div className="mock-crop-mark tr"></div>
                      <div className="mock-crop-mark bl"></div>
                      <div className="mock-crop-mark br"></div>
                    </div>
                    <div className="idcard-mock-slot filled back-glow">
                      <div className="mock-card-face">
                        <div className="mock-lines-back">
                          <div className="mock-line-full"></div>
                          <div className="mock-line-full"></div>
                          <div className="mock-line-full"></div>
                        </div>
                        <span className="face-lbl">BACK</span>
                      </div>
                      <div className="mock-crop-mark tl"></div>
                      <div className="mock-crop-mark tr"></div>
                      <div className="mock-crop-mark bl"></div>
                      <div className="mock-crop-mark br"></div>
                    </div>
                  </div>
                  <div className="id-print-bar">
                    <i className="ph ph-crop"></i>
                    <span className="preset-label">Auto-align to CR80 standard</span>
                  </div>
                </div>
              </div>
              <div className="tool-info">
                <h2>ID Card Layout Studio</h2>
                <p>
                  Arrange Aadhaar, PAN, Voter ID, and any card scan onto a print-ready A4
                  sheet. Crop, enhance, and export at full resolution — straight from
                  your browser, no software needed.
                </p>
              </div>
              <div className="feature-tags">
                <span className="feature-tag">CR80 Auto-Sizing</span>
                <span className="feature-tag">Scan Enhancement</span>
                <span className="feature-tag">Multi-Page Export</span>
              </div>
            </div>
            <div className="btn-arrow">Open Studio <i className="ph ph-arrow-right"></i></div>
          </Link>

          {/* Image Enlarger */}
          <Link to="/image-enlarger" className="tool-card animate-up" id="card-enlarger">
            <div className="spotlight-glow"></div>
            <span className="tool-card-badge">
              <i className="ph ph-arrows-out"></i> Up to 16× Scale
            </span>
            <div className="tool-card-content">
              <div className="tool-card-visual">
                <div className="tool-card-visual-inner" style={{ background: 'linear-gradient(135deg, #0a0914 0%, #1a1040 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ph ph-image" style={{ fontSize: '1.5rem', color: '#a78bfa' }}></i>
                    </div>
                    <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>Original</span>
                  </div>
                  <i className="ph ph-arrows-right" style={{ color: '#7c3aed', fontSize: '1.2rem' }}></i>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 68, height: 68, borderRadius: 10, background: 'rgba(124,58,237,0.35)', border: '2px solid #7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}>
                      <i className="ph ph-image" style={{ fontSize: '2.2rem', color: '#a78bfa' }}></i>
                    </div>
                    <span style={{ fontSize: '0.6rem', color: '#a78bfa', fontWeight: 700 }}>2× — 16×</span>
                  </div>
                </div>
              </div>
              <div className="tool-info">
                <h2>AI Image Enlarger</h2>
                <p>
                  Upscale any photo up to 16× its original size. Use our Cutout.pro AI integration 
                  for high-definition face enhancement, or choose between crisp pixel-art and smooth bilinear modes.
                </p>
              </div>
              <div className="feature-tags">
                <span className="feature-tag">Cloud AI Upscale</span>
                <span className="feature-tag">Up to 16× Scale</span>
                <span className="feature-tag">4 Quality Modes</span>
              </div>
            </div>
            <div className="btn-arrow">Open Enlarger <i className="ph ph-arrow-right"></i></div>
          </Link>

        </div>

        {/* ── Why Choose Us ── */}
        <section className="features-section animate-fade-in">
          <p className="section-label">Why Amrit Enterprises?</p>
          <h2 className="section-title">Built Different. Built for You.</h2>
          <p className="section-desc">
            We believe document tools should be fast, safe, and accessible to everyone —
            without subscriptions or cloud lock-in.
          </p>
          <div className="feature-cards">
            {[
              { icon: 'ph-lock-key', title: 'Zero Data Exposure', desc: 'Every operation runs inside your own browser tab. Your photos, scans, and files are never transmitted to any server — not even ours.' },
              { icon: 'ph-rocket-launch', title: 'Instant Results', desc: 'No queues, no server wait times. Your device does all the processing, so results are ready the moment you click.' },
              { icon: 'ph-hand-heart', title: 'Always Free', desc: 'No freemium tricks, no watermarks, no hidden paywalls. Amrit Enterprises keeps all tools fully free — for everyone, always.' },
              { icon: 'ph-cloud-slash', title: 'Internet-Optional', desc: 'Once loaded, the core tools continue working even if your connection drops. Reliable even on the go.' },
            ].map(({ icon, title, desc }) => (
              <div className="feature-card" key={title}>
                <div className="feature-icon"><i className={`ph ${icon}`}></i></div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="hub-footer animate-fade-in">
          <p>Every file you process stays on your device — guaranteed by design, not just policy.</p>
          <div className="footer-badges">
            <span><i className="ph ph-lock-simple"></i> No Uploads Ever</span>
            <span><i className="ph ph-cloud-slash"></i> Cloud-Free</span>
            <span><i className="ph ph-currency-circle-dollar"></i> Free Forever</span>
          </div>
          <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', opacity: 0.55 }}>
            © 2026 Amrit Enterprises — Smart Document Utilities. All rights reserved.
          </p>
        </footer>

      </main>
    </>
  )
}
