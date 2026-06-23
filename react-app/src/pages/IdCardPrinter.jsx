import { useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import '../styles/id-card-printer.css'

export default function IdCardPrinter() {
  const initialized = useRef(false)
  const scriptRef = useRef(null)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Set PDF.js worker
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }

    // Load the ID card engine script and initialize
    const script = document.createElement('script')
    script.src = import.meta.env.BASE_URL + 'id-card-app.js?v=' + Date.now()
    script.onload = () => {
      if (window.__bgradeIdCardInit) {
        window.__bgradeIdCardInit()
      }
    }
    script.onerror = () => console.error('Failed to load id-card-app.js')
    document.body.appendChild(script)
    scriptRef.current = script

    return () => {
      // Cleanup: remove script on unmount
      try {
        if (scriptRef.current && document.body.contains(scriptRef.current)) {
          document.body.removeChild(scriptRef.current)
        }
      } catch (e) {}
      // Reset the global init function
      delete window.__bgradeIdCardInit
    }
  }, [])

  return (
    <>
      <Navbar />
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      {/* Toast Notifications */}
      <div className="toast-container" id="toast-container"></div>

      {/* Fullscreen Workspace */}
      <main className="dashboard-workspace">

        {/* LEFT PANEL: CONTROL SIDEBAR */}
        <aside className="control-sidebar">
          <div className="sidebar-scrollable-content">

            {/* 1. SELECT TYPE */}
            <section className="sidebar-section">
              <div className="section-title-row">
                <h3>1. Select Type</h3>
                <span className="badge-free-pro">Free &bull; Pro</span>
              </div>
              <div className="type-selectors-grid">
                <button className="type-btn active" id="type-idcard" data-type="side-by-side">
                  <i className="ph ph-identification-card"></i><span>ID Card</span>
                </button>
                <button className="type-btn" id="type-a4page" data-type="stacked">
                  <i className="ph ph-note"></i><span>A4 Page</span>
                </button>
                <button className="type-btn" id="type-pvc" data-type="pvc">
                  <i className="ph ph-sim-card"></i><span>PVC</span>
                </button>
                <button className="type-btn" id="type-custom" data-type="custom">
                  <i className="ph ph-frame-corners"></i><span>Custom</span>
                </button>
              </div>
              <div className="checkbox-row" style={{ marginTop: '0.75rem' }}>
                <input type="checkbox" id="single-side-mode" />
                <label htmlFor="single-side-mode">Single Side Mode</label>
              </div>
            </section>

            {/* 2. PRINT QUEUE */}
            <section className="sidebar-section">
              <div className="section-title-row">
                <h3>2. Print Queue</h3>
                <span className="badge" id="active-page-badge">Page 1</span>
                <button className="btn-text btn-danger-text" id="btn-reset-sheet" style={{ fontSize: '0.75rem' }}>
                  <i className="ph ph-trash-simple"></i> Reset All
                </button>
              </div>
              <div className="queue-cards-wrapper">
                <div className="queue-cards" id="queue-cards-list">
                  <div className="empty-queue-text">No cards loaded on sheet</div>
                </div>
              </div>
              <div className="page-queue-actions">
                <button className="btn btn-sm btn-outline-primary" id="btn-add-page">
                  <i className="ph ph-plus"></i> Add Page
                </button>
                <button className="btn btn-sm btn-outline-danger" id="btn-delete-page">
                  <i className="ph ph-trash"></i> Delete Page
                </button>
              </div>
            </section>

            {/* 3. SPACING SETTINGS */}
            <section className="sidebar-section settings-section">
              <div className="section-title-row">
                <h3>3. Spacing Settings</h3>
              </div>
              <div className="settings-sliders">
                <div className="slider-row">
                  <span>Margin (mm)</span>
                  <input type="range" id="sheet-margin" min="5" max="30" defaultValue="10" />
                  <span className="val-display" id="sheet-margin-val">10mm</span>
                </div>
                <div className="slider-row" style={{ marginTop: '0.5rem' }}>
                  <span>Gap Horiz (mm)</span>
                  <input type="range" id="card-gap" min="0" max="25" defaultValue="6" />
                  <span className="val-display" id="card-gap-val">6mm</span>
                </div>
                <div className="slider-row" style={{ marginTop: '0.5rem' }}>
                  <span>Gap Vert (mm)</span>
                  <input type="range" id="card-gap-y" min="0" max="25" defaultValue="6" />
                  <span className="val-display" id="card-gap-y-val">6mm</span>
                </div>
                <div className="checkbox-row" style={{ marginTop: '0.75rem' }}>
                  <input type="checkbox" id="show-crop-marks" defaultChecked />
                  <label htmlFor="show-crop-marks">Add Corner Crop Marks</label>
                </div>
                <div className="checkbox-row">
                  <input type="checkbox" id="card-border" defaultChecked />
                  <label htmlFor="card-border">Thin Card Borders</label>
                </div>
                <div className="checkbox-row">
                  <input type="checkbox" id="rounded-corners" defaultChecked />
                  <label htmlFor="rounded-corners">Rounded corners</label>
                </div>
              </div>
            </section>

            {/* EXPORT & PRINT */}
            <div className="sidebar-footer-export">
              <div className="export-header-row">
                <h4>Export &amp; Print</h4>
                <span className="badge badge-hd-pro">
                  <i className="ph ph-crown-simple"></i> HD PRO UNLOCKED
                </span>
              </div>
              <div className="export-buttons-row">
                <button className="export-btn" id="btn-download-jpg" title="Download JPG">
                  <i className="ph ph-image"></i><span>JPG</span>
                </button>
                <button className="export-btn" id="btn-download-pdf" title="Download PDF">
                  <i className="ph ph-file-pdf"></i><span>PDF</span>
                </button>
                <button className="export-btn active" id="btn-print-sheet" title="Print Layout">
                  <i className="ph ph-printer"></i><span>Print All</span>
                </button>
              </div>
              <p className="export-footer-desc">
                All exports are generated on your device. No files are sent to any server.
              </p>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL: INTERACTIVE CANVAS WORKSPACE */}
        <section className="canvas-workspace">
          {/* Interactive Zoom Area */}
          <div className="sheet-scroller-area">
            {/* Floating Zoom Toolbar */}
            <div className="floating-zoom-hud">
              <button className="zoom-btn" id="btn-zoom-out"><i className="ph ph-minus"></i></button>
              <span id="zoom-level">60%</span>
              <button className="zoom-btn" id="btn-zoom-in"><i className="ph ph-plus"></i></button>
            </div>

            <div className="a4-sheet-container">
              <div className="virtual-a4-page" id="a4-page">
                {/* Cards are rendered dynamically by the engine */}
                <div className="no-cards-msg">
                  <i className="ph ph-identification-card"></i>
                  <h3>Your layout is empty</h3>
                  <p>Upload a card scan using the Front or Back drop zones in a card slot. Sizing auto-adjusts to CR80 standard.</p>
                </div>
              </div>
            </div>
          </div>

          {/* FIGMA-LIKE CROP EDITOR SLIDE PANEL */}
          <div className="editor-backdrop" id="editor-backdrop"></div>
          <aside className="crop-editor-slidepanel" id="crop-editor-panel">
            <div className="slidepanel-header">
              <h4 id="editor-title"><i className="ph ph-crop"></i> Adjust &amp; Crop</h4>
              <div className="header-actions">
                <button className="btn btn-primary" id="btn-apply-editor" title="Apply adjustments">
                  Apply <i className="ph ph-check"></i>
                </button>
                <button
                  className="btn-toggle-maximize"
                  id="btn-delete-card-active"
                  title="Delete Card Set"
                  style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: 'none' }}
                >
                  <i className="ph ph-trash"></i>
                </button>
                <button className="btn-toggle-maximize" id="btn-maximize-editor" title="Maximize Screen">
                  <i className="ph ph-corners-out"></i>
                </button>
                <button className="btn-close-slidepanel" id="btn-close-editor" title="Close">
                  <i className="ph ph-x"></i>
                </button>
              </div>
            </div>

            <div className="slidepanel-scrollable-content">
              {/* Crop Viewport */}
              <div className="editor-viewport-wrapper">
                <div className="crop-viewport" id="editor-viewport">
                  {/* Canvas & Crop box loaded dynamically */}
                </div>
              </div>

              <div className="slidepanel-controls-group" id="editor-controls-group">
                {/* Fine-Tune Crop (Nudges) */}
                <div className="control-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Fine-Tune Crop Box</label>
                    <button className="btn-text" id="btn-maximize-editor-body" title="Maximize crop screen">
                      <i className="ph ph-corners-out"></i> Big Screen
                    </button>
                  </div>
                  <div className="nudge-controls-wrapper">
                    <div className="nudge-grid">
                      <button className="btn-nudge" id="btn-nudge-up" title="Move Up"><i className="ph ph-arrow-up"></i></button>
                      <button className="btn-nudge" id="btn-nudge-left" title="Move Left"><i className="ph ph-arrow-left"></i></button>
                      <button className="btn-nudge" id="btn-nudge-right" title="Move Right"><i className="ph ph-arrow-right"></i></button>
                      <button className="btn-nudge" id="btn-nudge-down" title="Move Down"><i className="ph ph-arrow-down"></i></button>
                    </div>
                    <div className="nudge-scale">
                      <button className="btn-nudge" id="btn-nudge-shrink" title="Shrink Frame"><i className="ph ph-minus"></i></button>
                      <span>Crop Scale</span>
                      <button className="btn-nudge" id="btn-nudge-grow" title="Grow Frame"><i className="ph ph-plus"></i></button>
                    </div>
                  </div>
                </div>

                {/* Preset selector */}
                <div className="control-group">
                  <label>Auto-Crop Preset</label>
                  <div className="presets-row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                    <button className="btn btn-sm btn-preset active" id="btn-preset-cr80">CR80 Sizing</button>
                    <button className="btn btn-sm btn-preset" id="btn-preset-aadhaar-front">Aadhaar Front</button>
                    <button className="btn btn-sm btn-preset" id="btn-preset-aadhaar-back">Aadhaar Back</button>
                    <button className="btn btn-sm btn-preset" id="btn-preset-pan">PAN Card</button>
                    <button className="btn btn-sm btn-preset" id="btn-preset-custom">Free Custom</button>
                  </div>
                </div>

                {/* Filters */}
                <div className="control-group">
                  <label>Document Scan Filters</label>
                  <div className="filters-row">
                    <button className="btn btn-sm btn-filter active" id="btn-filter-none">Original</button>
                    <button className="btn btn-sm btn-filter" id="btn-filter-document" title="Enhance text and clear shadows">Scan Document</button>
                    <button className="btn btn-sm btn-filter" id="btn-filter-mono">B&amp;W text</button>
                  </div>
                  <div className="filters-row" style={{ marginTop: '0.4rem' }}>
                    <button className="btn btn-sm btn-filter" id="btn-filter-enhance" title="Auto color enhance contrast">
                      <i className="ph ph-sparkle"></i> Auto-Enhance
                    </button>
                    <button className="btn btn-sm btn-filter" id="btn-filter-invert" title="Invert document scan colors">
                      <i className="ph ph-swap"></i> Invert Colors
                    </button>
                  </div>
                </div>

                {/* Image Settings / Sliders */}
                <div className="control-group">
                  <div className="sliders-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Image Settings</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button className="btn-text" id="btn-center-crop" title="Center the crop area">Center Crop</button>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>|</span>
                      <button className="btn-text" id="btn-reset-filters">Reset <i className="ph ph-arrows-counter-clockwise"></i></button>
                    </div>
                  </div>
                  <div className="slider-row">
                    <span>Brightness</span>
                    <input type="range" id="slider-brightness" min="50" max="150" defaultValue="100" />
                    <span className="val-display" id="val-brightness">100%</span>
                  </div>
                  <div className="slider-row">
                    <span>Contrast</span>
                    <input type="range" id="slider-contrast" min="50" max="150" defaultValue="100" />
                    <span className="val-display" id="val-contrast">100%</span>
                  </div>
                  <div className="slider-row">
                    <span>Saturation</span>
                    <input type="range" id="slider-saturate" min="0" max="200" defaultValue="100" />
                    <span className="val-display" id="val-saturate">100%</span>
                  </div>
                </div>

                {/* Rotation & Flip */}
                <div className="control-group">
                  <label>Transform &amp; Mirror</label>
                  <div className="rotate-btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <button className="btn btn-sm btn-outline" id="btn-rotate-ccw" style={{ padding: '0.45rem 0.25rem' }}>
                      <i className="ph ph-arrow-counter-clockwise"></i> Rotate L
                    </button>
                    <button className="btn btn-sm btn-outline" id="btn-rotate-cw" style={{ padding: '0.45rem 0.25rem' }}>
                      <i className="ph ph-arrow-clockwise"></i> Rotate R
                    </button>
                    <button className="btn btn-sm btn-outline" id="btn-flip-h" style={{ padding: '0.45rem 0.25rem' }} title="Mirror horizontally">
                      <i className="ph ph-swap"></i> Flip Horiz
                    </button>
                    <button className="btn btn-sm btn-outline" id="btn-flip-v" style={{ padding: '0.45rem 0.25rem' }} title="Mirror vertically">
                      <i className="ph ph-flip-vertical"></i> Flip Vert
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </>
  )
}
