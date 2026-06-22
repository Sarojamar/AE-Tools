import React, { useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import '../styles/image-enlarger.css'

export default function ImageEnlarger() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const $ = id => document.getElementById(id)
    const state = {
      originalFile: null,
      originalImg: null,
      enlargedCanvas: null,
      scale: 2,
      customScale: 2,
      quality: 'ai',
      format: 'png',
      jpegQuality: 92,
      sharpen: 60,       // 0–200 unsharp mask amount
      compareX: 50,
      dragging: false
    }

    // ── Toast ─────────────────────────────────────────────
    function toast(msg, type = 'info') {
      const icons = { success: 'ph-check-circle', error: 'ph-x-circle', info: 'ph-info' }
      const t = document.createElement('div')
      t.className = `el-toast ${type}`
      t.innerHTML = `<i class="ph ${icons[type] || 'ph-info'}"></i><span>${msg}</span>`
      const c = $('el-toast-container')
      if (c) c.appendChild(t)
      setTimeout(() => t.remove(), 4000)
    }

    // ── Upload ─────────────────────────────────────────────
    const fileInput = $('el-file-input')
    const uploadZone = $('el-upload-zone')
    $('el-upload-btn').onclick = () => fileInput.click()
    uploadZone.onclick = e => { if (e.target !== $('el-upload-btn')) fileInput.click() }
    uploadZone.ondragover = e => { e.preventDefault(); uploadZone.classList.add('drag-over') }
    uploadZone.ondragleave = () => uploadZone.classList.remove('drag-over')
    uploadZone.ondrop = e => {
      e.preventDefault(); uploadZone.classList.remove('drag-over')
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
    }
    fileInput.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]) }
    $('el-change-btn').onclick = () => {
      state.originalFile = null; state.originalImg = null; state.enlargedCanvas = null
      $('el-upload-zone').style.display = ''
      $('el-studio').style.display = 'none'
      $('el-download-btn').disabled = true
    }

    function handleFile(file) {
      if (!file.type.startsWith('image/')) { toast('Please upload a valid image file.', 'error'); return }
      if (file.size > 40 * 1024 * 1024) { toast('File too large (max 40 MB)', 'error'); return }
      state.originalFile = file
      const reader = new FileReader()
      reader.onload = ev => {
        const img = new Image()
        img.onload = () => {
          state.originalImg = img
          $('el-upload-zone').style.display = 'none'
          $('el-studio').style.display = 'grid'
          $('el-before-img').src = ev.target.result
          $('el-after-img').src = ev.target.result
          updateInfo()
          toast('Image loaded! Click Enlarge to process.', 'success')
        }
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    }

    function formatBytes(b) {
      if (b < 1024) return b + ' B'
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
      return (b / 1024 / 1024).toFixed(2) + ' MB'
    }

    function updateInfo() {
      if (!state.originalImg) return
      const img = state.originalImg
      $('el-orig-dims').innerText = `${img.naturalWidth} × ${img.naturalHeight} px`
      $('el-orig-size').innerText = formatBytes(state.originalFile?.size || 0)
      const sc = state.scale
      $('el-new-dims').innerText = `${Math.round(img.naturalWidth * sc)} × ${Math.round(img.naturalHeight * sc)} px`
      $('el-new-size').innerText = `~${formatBytes(img.naturalWidth * sc * img.naturalHeight * sc * 3)}`
    }

    // ── Scale buttons ──────────────────────────────────────
    document.querySelectorAll('.el-scale-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.el-scale-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        const v = btn.dataset.scale
        if (v === 'custom') {
          $('el-custom-row').style.display = 'flex'
          state.scale = state.customScale
        } else {
          $('el-custom-row').style.display = 'none'
          state.scale = parseFloat(v)
        }
        updateInfo()
      }
    })
    $('el-custom-scale').oninput = e => {
      const v = parseFloat(e.target.value)
      if (v >= 1.1 && v <= 16) { state.customScale = v; state.scale = v; updateInfo() }
    }

    // ── Quality buttons ────────────────────────────────────
    document.querySelectorAll('.el-quality-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.el-quality-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        state.quality = btn.dataset.quality
        // Auto-set sensible default sharpen per mode
        const defaults = { nearest: 0, smooth: 60, progressive: 120 }
        const def = defaults[state.quality] ?? 60
        state.sharpen = def
        if ($('sl-sharpen')) { $('sl-sharpen').value = def; $('val-sharpen').innerText = def }
        if ($('el-api-key-row')) { $('el-api-key-row').style.display = (state.quality === 'ai') ? 'flex' : 'none' }
      }
    })

    // ── Preview Zoom Slider is defined later with Panning ──

    // ── API Key Input ─────────────────────────────────────
    if ($('inp-api-key')) {
      $('inp-api-key').value = localStorage.getItem('cutout_api_key') || ''
      $('inp-api-key').oninput = e => localStorage.setItem('cutout_api_key', e.target.value)
    }

    // ── Sharpen slider ─────────────────────────────────────
    if ($('sl-sharpen')) {
      $('sl-sharpen').oninput = e => {
        state.sharpen = parseInt(e.target.value)
        $('val-sharpen').innerText = e.target.value
      }
    }

    // ── Format chips ───────────────────────────────────────
    document.querySelectorAll('.el-fmt-chip').forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll('.el-fmt-chip').forEach(c => c.classList.remove('active'))
        chip.classList.add('active')
        state.format = chip.dataset.fmt
        $('el-jpeg-quality-row').style.display = ['jpeg', 'webp'].includes(state.format) ? 'flex' : 'none'
      }
    })
    $('sl-jpeg-quality').oninput = e => {
      $('val-jpeg-quality').innerText = e.target.value + '%'
      state.jpegQuality = parseInt(e.target.value)
    }

    // ── Unsharp Mask ──────────────────────────────────────
    // Uses CSS blur (GPU) for the blur pass, then pixel-level combine
    // result[i] = clamp(orig[i] + amount * (orig[i] - blurred[i]), 0, 255)
    async function applyUnsharpMask(canvas, amount, blurRadius) {
      if (amount <= 0) return
      const w = canvas.width, h = canvas.height
      const ctx = canvas.getContext('2d')

      // Create blurred copy using CSS blur (hardware-accelerated)
      const blurCanvas = document.createElement('canvas')
      blurCanvas.width = w; blurCanvas.height = h
      const bCtx = blurCanvas.getContext('2d')
      bCtx.filter = `blur(${blurRadius}px)`
      bCtx.drawImage(canvas, 0, 0)
      bCtx.filter = 'none'

      await new Promise(r => setTimeout(r, 10)) // yield for GPU flush

      // Read pixel data from both
      const origData  = ctx.getImageData(0, 0, w, h)
      const blurData  = bCtx.getImageData(0, 0, w, h)
      const orig      = origData.data
      const blurred   = blurData.data
      const factor    = amount / 100  // e.g. 60 → 0.6, 120 → 1.2

      for (let i = 0; i < orig.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const o = orig[i + c]
          const b = blurred[i + c]
          const diff = o - b               // high-frequency "detail" signal
          orig[i + c] = Math.max(0, Math.min(255, Math.round(o + factor * diff)))
        }
        // alpha unchanged
      }
      ctx.putImageData(origData, 0, 0)
    }

    // ── Core Upscale Engine ───────────────────────────────
    async function enlargeImage() {
      if (!state.originalImg) { toast('Upload an image first.', 'error'); return }

      const btn = $('el-process-btn')
      btn.disabled = true
      btn.innerHTML = `<i class="ph ph-spinner animate-spin"></i> Processing…`

      const progress = $('el-progress-fill')
      const progressLabel = $('el-progress-label')
      const setProgress = (pct, label) => {
        progress.style.width = pct + '%'
        if (progressLabel) progressLabel.innerText = label
      }

      try {
        await new Promise(r => setTimeout(r, 30))
        setProgress(10, 'Reading source image…')
        await new Promise(r => setTimeout(r, 30))

        const src = state.originalImg
        const targetW = Math.round(src.naturalWidth * state.scale)
        const targetH = Math.round(src.naturalHeight * state.scale)

        // Compute blur radius for unsharp mask (scale with output size)
        const blurRadius = Math.max(0.6, Math.min(4, targetW / 1200))

        let canvas

        if (state.quality === 'nearest') {
          // Nearest-neighbour — crisp pixel-art style, no sharpening needed
          canvas = document.createElement('canvas')
          canvas.width = targetW; canvas.height = targetH
          const ctx = canvas.getContext('2d')
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(src, 0, 0, targetW, targetH)
          setProgress(80, 'Rendering crisp edges…')

        } else if (state.quality === 'smooth') {
          // High-quality bilinear then unsharp mask
          canvas = document.createElement('canvas')
          canvas.width = targetW; canvas.height = targetH
          const ctx = canvas.getContext('2d')
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(src, 0, 0, targetW, targetH)
          setProgress(60, 'Bilinear upscale complete…')

          if (state.sharpen > 0) {
            setProgress(70, 'Applying unsharp mask…')
            await applyUnsharpMask(canvas, state.sharpen, blurRadius)
          }
          setProgress(85, 'Finalizing…')

        } else if (state.quality === 'progressive') {
          // Progressive multi-step + stronger unsharp mask
          setProgress(10, 'Step 1 — Progressive upscale…')
          canvas = document.createElement('canvas')
          canvas.width = src.naturalWidth; canvas.height = src.naturalHeight
          const ctx0 = canvas.getContext('2d')
          ctx0.imageSmoothingEnabled = true
          ctx0.imageSmoothingQuality = 'high'
          ctx0.drawImage(src, 0, 0)

          // Step up in 1.5× increments to minimise interpolation artifacts
          let curW = src.naturalWidth; let curH = src.naturalHeight
          const steps = []
          while (curW < targetW || curH < targetH) {
            const nextW = Math.min(Math.round(curW * 1.5), targetW)
            const nextH = Math.min(Math.round(curH * 1.5), targetH)
            steps.push([nextW, nextH])
            if (nextW === targetW && nextH === targetH) break
            curW = nextW; curH = nextH
          }
          const totalSteps = steps.length
          for (let i = 0; i < totalSteps; i++) {
            const [sw, sh] = steps[i]
            const next = document.createElement('canvas')
            next.width = sw; next.height = sh
            const nctx = next.getContext('2d')
            nctx.imageSmoothingEnabled = true
            nctx.imageSmoothingQuality = 'high'
            nctx.drawImage(canvas, 0, 0, sw, sh)
            canvas = next
            setProgress(10 + Math.round((i + 1) / totalSteps * 55), `Progressive step ${i + 1}/${totalSteps}…`)
            await new Promise(r => setTimeout(r, 8))
          }

          if (state.sharpen > 0) {
            setProgress(70, 'Applying unsharp mask (pass 1)…')
            await applyUnsharpMask(canvas, state.sharpen * 0.7, blurRadius)
            setProgress(82, 'Applying unsharp mask (pass 2)…')
            await applyUnsharpMask(canvas, state.sharpen * 0.4, blurRadius * 0.5)
          }
          setProgress(88, 'Finalizing…')

        } else if (state.quality === 'ai') {
          const apiKey = $('inp-api-key')?.value?.trim()
          if (!apiKey) {
            throw new Error('Please enter your Cutout.pro API Key below the Quality settings to use Cloud AI Upscale.')
          }

          setProgress(10, 'Preparing image for cloud processing…')
          
          // The API expects a File object. We convert the source image to a Blob.
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = src.naturalWidth; tempCanvas.height = src.naturalHeight
          tempCanvas.getContext('2d').drawImage(src, 0, 0)
          
          const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/jpeg', 1.0))
          
          setProgress(30, 'Uploading to Cutout.pro AI Cloud…')
          
          const formData = new FormData()
          formData.append('file', blob, 'image.jpg')
          // We can also pass outputFormat and faceModel if desired, defaults are fine.
          
          const response = await fetch('https://www.cutout.pro/api/v1/photoEnhance2', {
            method: 'POST',
            headers: {
              'APIKEY': apiKey
            },
            body: formData
          })
          
          if (!response.ok) {
            throw new Error(`Cloud API Error: ${response.status} ${response.statusText}`)
          }
          
          setProgress(70, 'Processing complete, downloading…')
          const result = await response.json()
          
          if (result.code !== 0) {
            throw new Error(`Cutout.pro Error: ${result.msg || 'Unknown Error'}`)
          }
          
          // Load the base64 result into an image
          const currentImg = await new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('Failed to load result from API'))
            img.src = 'data:image/png;base64,' + result.data.imageBase
          })
          
          setProgress(85, 'Rendering final size…')
          
          // Draw the (potentially slightly larger) AI image onto the exact target canvas size
          canvas = document.createElement('canvas')
          canvas.width = targetW
          canvas.height = targetH
          const ctx = canvas.getContext('2d')
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(currentImg, 0, 0, targetW, targetH)
          
          if (state.sharpen > 0) {
            setProgress(90, 'Applying final sharpness pass…')
            await applyUnsharpMask(canvas, state.sharpen * 0.5, blurRadius * 0.8)
          }
        }

        setProgress(95, 'Generating preview…')
        await new Promise(r => setTimeout(r, 30))

        state.enlargedCanvas = canvas
        $('el-after-img').src = canvas.toDataURL('image/jpeg', 0.92) // JPEG for fast preview
        setProgress(100, '✓ Done!')

        $('el-download-btn').disabled = false
        toast('Image enlarged & sharpened successfully!', 'success')
        updateInfo()

      } catch (err) {
        console.error(err)
        toast('Processing failed: ' + err.message, 'error')
      } finally {
        btn.disabled = false
        btn.innerHTML = `<i class="ph ph-arrows-out"></i> Enlarge Image`
        setTimeout(() => setProgress(0, ''), 3000)
      }
    }

    $('el-process-btn').onclick = enlargeImage

    // ── Download ──────────────────────────────────────────
    $('el-download-btn').onclick = () => {
      if (!state.enlargedCanvas) { toast('Enlarge an image first.', 'error'); return }
      const mimeMap = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }
      const mime = mimeMap[state.format] || 'image/png'
      const quality = ['jpeg', 'webp'].includes(state.format) ? state.jpegQuality / 100 : 1
      const link = document.createElement('a')
      link.download = `AmritEnterprises_enlarged_${Math.round(state.scale)}x.${state.format}`
      link.href = state.enlargedCanvas.toDataURL(mime, quality)
      link.click()
      toast('Download started!', 'success')
    }

    // ── Compare slider drag & Panning ─────────────────────
    const compareWrap = $('el-compare-wrap')
    const compareInner = $('el-compare-inner')
    const afterEl = $('el-compare-after')
    const handle = $('el-compare-handle')

    let panX = 0, panY = 0
    let startPanX = 0, startPanY = 0
    let isPanning = false

    function setCompare(x) {
      const rect = compareWrap.getBoundingClientRect()
      const pct = Math.max(2, Math.min(98, ((x - rect.left) / rect.width) * 100))
      state.compareX = pct
      afterEl.style.clipPath = `inset(0 0 0 ${pct}%)`
      handle.style.left = pct + '%'
    }

    function updateTransform() {
      const z = $('sl-preview-zoom') ? parseFloat($('sl-preview-zoom').value) : 1
      if (compareInner) {
        compareInner.style.transform = `scale(${z}) translate(${panX / z}px, ${panY / z}px)`
      }
    }

    if ($('sl-preview-zoom')) {
      $('sl-preview-zoom').oninput = e => {
        $('val-preview-zoom').innerText = parseFloat(e.target.value).toFixed(1) + 'x'
        updateTransform()
      }
    }

    handle.onmousedown = e => { e.preventDefault(); e.stopPropagation(); state.dragging = true }
    handle.ontouchstart = e => { e.stopPropagation(); state.dragging = true }

    compareWrap.onmousedown = e => { 
      e.preventDefault()
      if (e.target === handle) return
      isPanning = true
      compareWrap.style.cursor = 'grabbing'
      startPanX = e.clientX - panX
      startPanY = e.clientY - panY
    }
    
    document.addEventListener('mousemove', e => { 
      if (state.dragging) setCompare(e.clientX) 
      if (isPanning) {
        panX = e.clientX - startPanX
        panY = e.clientY - startPanY
        updateTransform()
      }
    })
    
    document.addEventListener('mouseup', () => { 
      state.dragging = false 
      isPanning = false
      if (compareWrap) compareWrap.style.cursor = 'grab'
    })
    
    compareWrap.ontouchstart = e => {
      if (e.target === handle) return
      if (e.touches.length === 1) {
        isPanning = true
        startPanX = e.touches[0].clientX - panX
        startPanY = e.touches[0].clientY - panY
      }
    }
    
    document.addEventListener('touchmove', e => { 
      if (state.dragging && e.touches[0]) setCompare(e.touches[0].clientX) 
      if (isPanning && e.touches[0]) {
        panX = e.touches[0].clientX - startPanX
        panY = e.touches[0].clientY - startPanY
        updateTransform()
      }
    }, { passive: false })
    
    document.addEventListener('touchend', () => { 
      state.dragging = false 
      isPanning = false
    })

  }, [])

  return (
    <>
      <Navbar />
      <div className="el-toast-container" id="el-toast-container"></div>

      {/* Header */}
      <div className="el-header">
        <div className="el-header-inner">
          <div className="el-title-block">
            <span className="el-badge">
              <i className="ph ph-arrows-out"></i> Browser &amp; Cloud Hybrid
            </span>
            <h1>AI Image<br /><em>Enlarger</em></h1>
            <p>
              Upscale any image up to 16×. Use our Cutout.pro AI integration for incredible
              face and detail enhancements, or use local bilinear interpolation.
            </p>
          </div>
        </div>
      </div>

      <div className="el-workspace">

        {/* Upload Zone */}
        <div id="el-upload-zone" className="el-upload-zone">
          <i className="ph ph-image upload-icon"></i>
          <h3>Drop your image here</h3>
          <p>JPG, PNG, WEBP, GIF &nbsp;·&nbsp; Max 40 MB</p>
          <button className="el-upload-btn" id="el-upload-btn">
            <i className="ph ph-folder-open"></i> Choose Image
          </button>
          <input type="file" id="el-file-input" accept="image/*" className="el-upload-input" />
        </div>

        {/* Studio */}
        <div className="el-studio" id="el-studio" style={{ display: 'none' }}>

          {/* Left — Preview */}
          <div className="el-preview-panel">
            <div className="el-panel-header">
              <span><i className="ph ph-arrows-horizontal"></i> Before / After Comparison</span>
              <button className="el-change-btn" id="el-change-btn">
                <i className="ph ph-arrow-left"></i> Change Image
              </button>
            </div>

            <div className="el-compare-wrap" id="el-compare-wrap" style={{ overflow: 'hidden', position: 'relative', cursor: 'grab' }}>
              <div id="el-compare-inner" style={{ width: '100%', height: '100%', transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}>
                <div className="el-compare-before">
                  <img id="el-before-img" alt="Original" />
                </div>
                <div className="el-compare-after" id="el-compare-after" style={{ clipPath: 'inset(0 0 0 50%)' }}>
                  <img id="el-after-img" alt="Enlarged" />
                </div>
              </div>
              <div className="el-compare-handle" id="el-compare-handle" style={{ cursor: 'ew-resize' }}></div>
              <span className="el-compare-label before">ORIGINAL</span>
              <span className="el-compare-label after">ENLARGED</span>
            </div>

            <div className="el-info-bar">
              <div className="el-info-cell">
                <span className="el-info-cell-label">Original</span>
                <span className="el-info-cell-value" id="el-orig-dims">— px</span>
                <span className="el-info-cell-sub" id="el-orig-size">—</span>
              </div>
              <div className="el-info-cell">
                <span className="el-info-cell-label">Enlarged</span>
                <span className="el-info-cell-value" id="el-new-dims">— px</span>
                <span className="el-info-cell-sub" id="el-new-size">—</span>
              </div>
            </div>

            <div className="el-preview-zoom-bar" style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 'bold' }}><i className="ph ph-magnifying-glass-plus"></i> Preview Zoom</label>
              <input type="range" id="sl-preview-zoom" min="1" max="4" step="0.1" defaultValue="1" style={{ flexGrow: 1 }} />
              <span id="val-preview-zoom" style={{ fontSize: '0.85rem', minWidth: '2.5rem', textAlign: 'right' }}>1.0x</span>
            </div>

          </div>

          {/* Right — Settings */}
          <div className="el-settings-panel">

            {/* Scale */}
            <div className="el-settings-card">
              <div className="el-card-title"><i className="ph ph-arrows-out"></i> Enlargement Scale</div>
              <div className="el-card-body">
                <div className="el-scale-grid">
                  {[
                    { label: '1.5×', val: '1.5' },
                    { label: '2×',   val: '2', active: true },
                    { label: '3×',   val: '3' },
                    { label: '4×',   val: '4' },
                    { label: '6×',   val: '6' },
                    { label: '8×',   val: '8' },
                    { label: '12×',  val: '12' },
                    { label: 'Custom', val: 'custom' },
                  ].map(({ label, val, active }) => (
                    <button
                      key={val}
                      className={`el-scale-btn${active ? ' active' : ''}`}
                      data-scale={val}
                    >{label}</button>
                  ))}
                </div>
                <div id="el-custom-row" className="el-custom-row" style={{ display: 'none' }}>
                  <label>Scale ×</label>
                  <input
                    type="number" id="el-custom-scale" className="el-custom-input"
                    min="1.1" max="16" step="0.1" defaultValue="2"
                    placeholder="e.g. 2.5"
                  />
                </div>
              </div>
            </div>

            {/* Quality */}
            <div className="el-settings-card">
              <div className="el-card-title"><i className="ph ph-sparkle"></i> Upscale Method</div>
              <div className="el-card-body">
                <div className="el-quality-grid">
                  {[
                    { q: 'nearest',     icon: 'ph-grid-four',   label: 'Sharp / Pixel Art',    desc: 'Nearest-neighbor — crisp edges, good for logos' },
                    { q: 'smooth',      icon: 'ph-drop-half',   label: 'Smooth + Sharpen',     desc: 'Bilinear upscale + unsharp mask (recommended)' },
                    { q: 'progressive', icon: 'ph-magic-wand',  label: 'Progressive + Sharpen',desc: '1.5× multi-step + double sharpening pass' },
                    { q: 'ai',          icon: 'ph-brain',       label: 'AI Upscale (ESRGAN)',  desc: 'Neural network — cloud processing for best detail' },
                  ].map(({ q, icon, label, desc }) => (
                    <button
                      key={q}
                      className={`el-quality-btn${q === 'ai' ? ' active' : ''}`}
                      data-quality={q}
                    >
                      <i className={`ph ${icon}`}></i>
                      <span>
                        {label}
                        <span className="q-desc">{desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="el-slider-row" style={{ marginTop: '0.5rem' }}>
                  <label>Sharpen</label>
                  <input type="range" id="sl-sharpen" min="0" max="200" defaultValue="60" />
                  <span className="el-slider-val" id="val-sharpen">60</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.2rem' }}>
                  0 = off · 60 = natural · 120 = strong · 200 = max
                </div>
                <div id="el-api-key-row" className="el-slider-row" style={{ display: 'none', flexDirection: 'column', alignItems: 'flex-start', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                  <label style={{ marginBottom: '0.5rem', color: '#a78bfa' }}><i className="ph ph-key"></i> Cutout.pro API Key</label>
                  <input type="password" id="inp-api-key" placeholder="Enter your API Key here" style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '6px', fontFamily: 'monospace' }} />
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.4rem', lineHeight: '1.4' }}>
                    Required for Cloud AI Upscale. Get it from <a href="https://www.cutout.pro/" target="_blank" rel="noreferrer" style={{color:'#a78bfa'}}>cutout.pro</a>. Kept securely in your browser.
                  </div>
                </div>
              </div>
            </div>

            {/* Output Format */}
            <div className="el-settings-card">
              <div className="el-card-title"><i className="ph ph-file-image"></i> Output Format</div>
              <div className="el-card-body">
                <div className="el-fmt-chips">
                  {['png', 'jpeg', 'webp'].map((f, i) => (
                    <div key={f} className={`el-fmt-chip${i === 0 ? ' active' : ''}`} data-fmt={f}>
                      {f.toUpperCase()}
                    </div>
                  ))}
                </div>
                <div id="el-jpeg-quality-row" className="el-slider-row" style={{ display: 'none' }}>
                  <label>Quality</label>
                  <input type="range" id="sl-jpeg-quality" min="40" max="100" defaultValue="92" />
                  <span className="el-slider-val" id="val-jpeg-quality">92%</span>
                </div>
              </div>
            </div>

            {/* Process */}
            <div className="el-settings-card">
              <div className="el-card-body">
                <div className="el-progress-wrap">
                  <div className="el-progress-bar">
                    <div className="el-progress-fill" id="el-progress-fill"></div>
                  </div>
                  <div className="el-progress-label" id="el-progress-label"></div>
                </div>
                <button className="el-process-btn" id="el-process-btn">
                  <i className="ph ph-arrows-out"></i> Enlarge Image
                </button>
                <button className="el-download-btn" id="el-download-btn" disabled>
                  <i className="ph ph-download-simple"></i> Download Enlarged Image
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
