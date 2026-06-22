import { useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import '../styles/file-converter.css'

export default function FileConverter() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Set up PDF.js worker
    if (typeof window.pdfjsLib !== 'undefined') {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }

    // ══════════════════════════════════════════════════════════════════
    //  BGrade Pro File Converter — Full Application Logic
    // ══════════════════════════════════════════════════════════════════
    const $ = id => document.getElementById(id)

    const state = {
      files: [], originalSizes: [],
      outputFormat: 'image/jpeg', outputExt: 'jpg',
      quality: 0.85, targetKB: null,
      dimW: null, dimH: null, keepRatio: true,
      step: 1, results: [], origDims: [],
    }

    function showToast(msg, type = 'info') {
      const icons = { success: 'ph-check-circle', error: 'ph-x-circle', info: 'ph-info' }
      const t = document.createElement('div')
      t.className = `toast ${type}`
      t.innerHTML = `<i class="ph ${icons[type]}"></i><span>${msg}</span>`
      const container = $('toast-container')
      if (container) container.appendChild(t)
      setTimeout(() => t.remove(), 4000)
    }

    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    }

    function goToStep(n) {
      state.step = n
      ;['step-1-btn', 'step-2-btn', 'step-3-btn'].forEach((id, i) => {
        const el = $(id); if (!el) return
        el.classList.remove('active', 'done')
        if (i + 1 < n) el.classList.add('done')
        else if (i + 1 === n) el.classList.add('active')
      })
      $('view-upload').classList.toggle('active', n === 1)
      $('view-configure').classList.toggle('active', n === 2)
      $('view-result').classList.toggle('active', n === 3)
    }

    // ── File Upload ────────────────────────────────────────────────────
    const fileInput = $('file-input')
    const uploadArea = $('upload-area')
    if (!fileInput || !uploadArea) return

    $('browse-btn').onclick = (e) => { e.stopPropagation(); fileInput.click() }
    uploadArea.onclick = (e) => { if (e.target.id !== 'browse-btn') fileInput.click() }
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over') })
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'))
    uploadArea.addEventListener('drop', e => {
      e.preventDefault(); uploadArea.classList.remove('drag-over')
      handleFiles([...e.dataTransfer.files])
    })

    const dragOverlay = $('drag-overlay')
    document.addEventListener('dragenter', () => dragOverlay?.classList.add('visible'))
    document.addEventListener('dragleave', e => { if (!e.relatedTarget) dragOverlay?.classList.remove('visible') })
    document.addEventListener('drop', e => {
      e.preventDefault(); dragOverlay?.classList.remove('visible')
      if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files])
    })
    document.addEventListener('dragover', e => e.preventDefault())

    fileInput.onchange = () => { if (fileInput.files.length) handleFiles([...fileInput.files]) }

    function handleFiles(files) {
      if (!files.length) return
      const supported = files.filter(f => f.type.match(/^image\/(jpeg|png|webp|gif)$/) || f.type === 'application/pdf')
      if (!supported.length) { showToast('No supported files. Please use JPG, PNG, WEBP, GIF, or PDF.', 'error'); return }
      if (supported.length > 20) { showToast('Max 20 files at once.', 'error'); return }
      state.files = supported; state.results = []
      loadFilePreview(supported[0])
      if (supported.length > 1) {
        $('batch-list').style.display = 'block'
        $('batch-count').textContent = supported.length
        const container = $('batch-items'); container.innerHTML = ''
        supported.forEach(f => {
          const item = document.createElement('div')
          item.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.6rem;background:var(--card-bg);border:1px solid var(--glass-border);border-radius:8px;font-size:0.78rem;'
          item.innerHTML = `<i class="ph ph-file-image" style="color:var(--primary);"></i><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span><span style="color:var(--text-muted);flex-shrink:0;">${formatBytes(f.size)}</span>`
          container.appendChild(item)
        })
      } else {
        $('batch-list').style.display = 'none'
      }
      goToStep(2)
    }

    function loadFilePreview(file) {
      $('file-info-name').textContent = file.name
      state.originalSizes = state.files.map(f => f.size)
      if (file.type === 'application/pdf') {
        $('file-info-icon').innerHTML = '<i class="ph ph-file-pdf"></i>'
        $('file-info-icon').style.cssText = 'background:rgba(239,68,68,0.15);color:#dc2626;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;'
        $('file-info-meta').textContent = formatBytes(file.size) + ' • PDF'
        $('preview-placeholder').style.display = ''
        $('preview-img').style.display = 'none'
        renderPDFPreview(file)
      } else {
        $('file-info-icon').innerHTML = '<i class="ph ph-file-image"></i>'
        $('file-info-icon').style.cssText = 'background:rgba(99,102,241,0.15);color:var(--primary);width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;'
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          state.origDims[0] = { w: img.naturalWidth, h: img.naturalHeight }
          $('file-info-meta').textContent = `${formatBytes(file.size)} • ${img.naturalWidth}×${img.naturalHeight}px`
          $('preview-img').src = url; $('preview-img').style.display = 'block'
          $('preview-placeholder').style.display = 'none'
        }
        img.src = url
      }
    }

    async function renderPDFPreview(file) {
      try {
        const ab = await file.arrayBuffer()
        const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise
        const page = await pdf.getPage(1)
        const vp = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        canvas.width = vp.width; canvas.height = vp.height
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
        $('preview-img').src = canvas.toDataURL(); $('preview-img').style.display = 'block'
        $('preview-placeholder').style.display = 'none'
        state.origDims[0] = { w: Math.round(vp.width), h: Math.round(vp.height) }
        $('file-info-meta').textContent = `${formatBytes(file.size)} • PDF (${Math.round(vp.width)}×${Math.round(vp.height)}px)`
      } catch (e) { console.warn('PDF preview failed', e) }
    }

    $('btn-change-file').onclick = () => { state.files = []; goToStep(1) }
    $('btn-convert-another').onclick = () => { state.files = []; goToStep(1) }
    $('btn-back-configure').onclick = () => goToStep(2)

    // ── Format Tabs ───────────────────────────────────────────────────
    document.querySelectorAll('.fmt-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.fmt-tab').forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        state.outputFormat = tab.dataset.fmt; state.outputExt = tab.dataset.ext
        const isLossless = state.outputFormat === 'image/png' || state.outputFormat === 'pdf' || state.outputFormat === 'image/gif'
        $('quality-group').style.opacity = isLossless ? '0.4' : '1'
        $('quality-group').style.pointerEvents = isLossless ? 'none' : ''
      }
    })

    $('sl-quality').oninput = () => {
      state.quality = parseInt($('sl-quality').value) / 100
      $('val-quality').textContent = $('sl-quality').value + '%'
    }

    const dimW = $('dim-w'), dimH = $('dim-h')
    dimW.oninput = () => {
      state.dimW = dimW.value ? parseInt(dimW.value) : null
      if ($('keep-ratio').checked && state.dimW && state.origDims[0]) {
        const ratio = state.origDims[0].h / state.origDims[0].w
        dimH.value = Math.round(state.dimW * ratio); state.dimH = parseInt(dimH.value)
      }
    }
    dimH.oninput = () => {
      state.dimH = dimH.value ? parseInt(dimH.value) : null
      if ($('keep-ratio').checked && state.dimH && state.origDims[0]) {
        const ratio = state.origDims[0].w / state.origDims[0].h
        dimW.value = Math.round(state.dimH * ratio); state.dimW = parseInt(dimW.value)
      }
    }
    $('keep-ratio').onchange = () => { state.keepRatio = $('keep-ratio').checked }

    // ── Process ──────────────────────────────────────────────────────
    $('btn-process').onclick = async () => {
      if (!state.files.length) { showToast('Please upload a file first.', 'error'); return }
      state.targetKB = $('target-kb').value ? parseFloat($('target-kb').value) : null
      $('progress-wrap').classList.add('visible')
      $('btn-process').disabled = true
      $('btn-process').innerHTML = '<i class="ph ph-spinner" style="animation:spin 0.8s linear infinite;display:inline-block;"></i> Processing…'
      try {
        state.results = []
        for (let i = 0; i < state.files.length; i++) {
          setProgress(Math.round((i / state.files.length) * 80), `Processing file ${i + 1} of ${state.files.length}…`)
          const result = await processFile(state.files[i], i)
          state.results.push(result)
        }
        setProgress(100, 'Done!')
        setTimeout(() => showResults(), 400)
      } catch (err) {
        showToast('Processing failed: ' + err.message, 'error')
      } finally {
        $('btn-process').disabled = false
        $('btn-process').innerHTML = '<i class="ph ph-gear"></i> Process & Download'
      }
    }

    function setProgress(pct, text) {
      $('progress-fill').style.width = pct + '%'
      $('progress-text').textContent = text
    }

    async function processFile(file, idx) {
      return file.type === 'application/pdf' ? processPDF(file, idx) : processImage(file, idx)
    }

    async function processImage(file, idx) {
      return new Promise((resolve, reject) => {
        const img = new Image(); const url = URL.createObjectURL(file)
        img.onload = () => {
          const origW = img.naturalWidth, origH = img.naturalHeight
          let targetW = state.dimW || origW; let targetH = state.dimH || origH
          if (state.keepRatio && (state.dimW || state.dimH)) {
            const ratio = origW / origH
            if (state.dimW && !state.dimH) targetH = Math.round(targetW / ratio)
            else if (state.dimH && !state.dimW) targetW = Math.round(targetH * ratio)
          }
          const canvas = document.createElement('canvas')
          canvas.width = targetW; canvas.height = targetH
          canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH)
          if (state.outputFormat === 'image/png' || state.outputFormat === 'image/gif') {
            canvas.toBlob(blob => { resolve({ blob, url: URL.createObjectURL(blob), name: changeName(file.name, state.outputExt), size: blob.size, origW, origH, newW: targetW, newH: targetH }) }, state.outputFormat === 'image/gif' ? 'image/png' : state.outputFormat)
            return
          }
          if (state.outputFormat === 'pdf') {
            const { jsPDF } = window.jspdf
            const pdf = new jsPDF({ unit: 'px', format: [targetW, targetH] })
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, targetW, targetH)
            const pdfBlob = pdf.output('blob')
            resolve({ blob: pdfBlob, url: URL.createObjectURL(pdfBlob), name: changeName(file.name, 'pdf'), size: pdfBlob.size, origW, origH, newW: targetW, newH: targetH })
            return
          }
          if (state.targetKB) {
            binarySearchQuality(canvas, state.outputFormat, state.targetKB * 1024, 0.01, 1.0, 20, blob => {
              resolve({ blob, url: URL.createObjectURL(blob), name: changeName(file.name, state.outputExt), size: blob.size, origW, origH, newW: targetW, newH: targetH })
            })
          } else {
            canvas.toBlob(blob => { resolve({ blob, url: URL.createObjectURL(blob), name: changeName(file.name, state.outputExt), size: blob.size, origW, origH, newW: targetW, newH: targetH }) }, state.outputFormat, state.quality)
          }
          URL.revokeObjectURL(url)
        }
        img.onerror = reject; img.src = url
      })
    }

    async function processPDF(file, idx) {
      const ab = await file.arrayBuffer()
      const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise
      const page = await pdf.getPage(1)
      const vp = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = vp.width; canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      if (state.outputFormat === 'pdf') {
        const origBlob = new Blob([ab], { type: 'application/pdf' })
        return { blob: origBlob, url: URL.createObjectURL(origBlob), name: file.name, size: origBlob.size, origW: vp.width, origH: vp.height, newW: vp.width, newH: vp.height }
      }
      return new Promise(resolve => {
        canvas.toBlob(blob => { resolve({ blob, url: URL.createObjectURL(blob), name: changeName(file.name, state.outputExt), size: blob.size, origW: Math.round(vp.width), origH: Math.round(vp.height), newW: Math.round(vp.width), newH: Math.round(vp.height) }) }, state.outputFormat === 'image/gif' ? 'image/png' : state.outputFormat, state.quality)
      })
    }

    function binarySearchQuality(canvas, mimeType, targetBytes, lo, hi, iters, cb) {
      if (iters === 0) { canvas.toBlob(cb, mimeType, lo); return }
      const mid = (lo + hi) / 2
      canvas.toBlob(blob => {
        if (blob.size <= targetBytes) { if (hi - lo < 0.01) cb(blob); else binarySearchQuality(canvas, mimeType, targetBytes, mid, hi, iters - 1, cb) }
        else binarySearchQuality(canvas, mimeType, targetBytes, lo, mid, iters - 1, cb)
      }, mimeType, mid)
    }

    function changeName(name, ext) { return name.replace(/\.[^.]+$/, '') + '.' + ext }

    function showResults() {
      if (!state.results.length) return
      const r = state.results[0]; const origFile = state.files[0]; const origSize = origFile.size
      const convImg = $('conv-img')
      if (r.blob.type !== 'application/pdf') { convImg.src = r.url; convImg.style.display = 'block' }
      else { convImg.style.display = 'none'; $('conv-preview').innerHTML = '<i class="ph ph-file-pdf" style="font-size:4rem;color:#dc2626;opacity:0.7;"></i>' }
      const origImg = $('orig-img')
      if (origFile.type !== 'application/pdf' && $('preview-img').src) { origImg.src = $('preview-img').src; origImg.style.display = 'block' }
      $('orig-size').textContent = formatBytes(origSize)
      $('orig-dims').textContent = r.origW + '×' + r.origH + 'px'
      $('orig-fmt').textContent = origFile.type.split('/')[1]?.toUpperCase() || 'FILE'
      $('conv-size').textContent = formatBytes(r.size)
      $('conv-dims').textContent = r.newW + '×' + r.newH + 'px'
      const reduction = ((1 - r.size / origSize) * 100).toFixed(1)
      $('conv-reduction').textContent = (reduction > 0 ? '-' : '+') + Math.abs(reduction) + '%'
      $('conv-reduction').className = 'result-stat-val ' + (reduction > 0 ? 'stat-green' : 'stat-red')
      if (state.results.length > 1) {
        $('batch-result-wrap').style.display = 'block'; $('result-grid').style.display = 'none'
        const tbody = $('batch-table-body'); tbody.innerHTML = ''
        state.results.forEach((res, i) => {
          const orig = state.files[i].size; const red = ((1 - res.size / orig) * 100).toFixed(1)
          const tr = document.createElement('tr')
          tr.innerHTML = `<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${res.name}</td><td>${formatBytes(orig)}</td><td>${formatBytes(res.size)}</td><td class="${red > 0 ? 'stat-green' : 'stat-red'}">${red > 0 ? '-' : '+'}${Math.abs(red)}%</td><td><span class="batch-row-status"><span class="status-dot success"></span> Done</span></td>`
          tbody.appendChild(tr)
        })
        $('btn-download-zip').style.display = ''
      }
      $('btn-download').onclick = () => {
        const link = document.createElement('a'); link.href = r.url; link.download = r.name; link.click()
      }
      $('btn-download-zip').onclick = async () => {
        const zip = new window.JSZip()
        state.results.forEach(res => zip.file(res.name, res.blob))
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const link = document.createElement('a'); link.href = URL.createObjectURL(zipBlob); link.download = 'AmritEnterprises_converted.zip'; link.click()
      }
      $('progress-wrap').classList.remove('visible')
      goToStep(3)
      showToast('File converted successfully!', 'success')
    }

    document.querySelectorAll('.kb-input, .dim-input').forEach(inp => {
      inp.addEventListener('focus', () => { inp.style.borderColor = 'var(--primary)'; inp.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)' })
      inp.addEventListener('blur', () => { inp.style.borderColor = ''; inp.style.boxShadow = '' })
    })
  }, [])

  return (
    <>
      <Navbar />
      <div className="drag-overlay" id="drag-overlay">
        <i className="ph ph-cloud-arrow-up" style={{fontSize:'4rem',color:'var(--primary)',marginBottom:'0.5rem'}}></i>
        <h2>Drop your files anywhere</h2>
        <p>Accepted: JPG, PNG, WEBP, GIF, PDF</p>
      </div>
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      <div className="toast-container" id="toast-container"></div>

      <div className="page-wrap">
        <header className="page-header animate-fade-in">
          <div className="badge"><i className="ph ph-cloud-slash"></i> Runs 100% Locally</div>
          <h1>Image &amp; File <span>Toolkit</span></h1>
          <p>Convert, resize, and compress images and PDFs without uploading anything. Unique KB targeting lets you hit an exact file size — great for government portals and email limits.</p>
        </header>

        <div className="stepper-wrap animate-fade-in">
          <div className="stepper">
            <div className="step active" id="step-1-btn"><div className="step-num">1</div><span>Upload</span></div>
            <div className="step-divider"></div>
            <div className="step" id="step-2-btn"><div className="step-num">2</div><span>Configure</span></div>
            <div className="step-divider"></div>
            <div className="step" id="step-3-btn"><div className="step-num">3</div><span>Result</span></div>
          </div>
        </div>

        <div className="glass-panel animate-up">
          {/* Step 1: Upload */}
          <div id="view-upload" className="view-section active">
            <div className="upload-drop-area" id="upload-area">
              <div className="upload-icon-wrapper"><i className="ph ph-cloud-arrow-up"></i></div>
              <h2>Drag &amp; Drop your file here</h2>
              <p>or click to browse from your device</p>
              <button className="btn primary-btn" id="browse-btn"><i className="ph ph-folder-open"></i> Choose File</button>
              <span className="supported-label">Supported: JPG, PNG, WEBP, GIF, PDF</span>
              <input type="file" id="file-input" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple style={{display:'none'}} />
            </div>
            <div className="formats-grid" style={{marginTop:'1.5rem',padding:'0 1.5rem 1.5rem'}}>
              {[{l:'JPG',c:'jpg',d:'Lossy compression'},{l:'PNG',c:'png',d:'Lossless + transparency'},{l:'WebP',c:'webp',d:'Modern web format'},{l:'PDF',c:'pdf',d:'Document export'},{l:'GIF',c:'gif',d:'Animation support'}].map(({l,c,d})=>(
                <div className="fmt-card" key={c}>
                  <div className={`fmt-icon ${c}`}>{l}</div>
                  <div className="fmt-name">{l}</div>
                  <div className="fmt-desc">{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Configure */}
          <div id="view-configure" className="view-section">
            <div className="preview-panel">
              <div className="file-info-card" id="file-info-card">
                <div className="file-info-icon" id="file-info-icon" style={{background:'rgba(245,158,11,0.15)',color:'#d97706'}}><i className="ph ph-file-image"></i></div>
                <div className="file-info-details">
                  <div className="file-info-name" id="file-info-name">filename.jpg</div>
                  <div className="file-info-meta" id="file-info-meta">0 KB • 0×0 px</div>
                </div>
                <button className="btn secondary-btn" id="btn-change-file" style={{padding:'0.5rem 0.9rem',fontSize:'0.8rem'}}><i className="ph ph-arrows-clockwise"></i> Change</button>
              </div>
              <div className="preview-container" id="preview-container">
                <div className="preview-placeholder" id="preview-placeholder"><i className="ph ph-image"></i><p>Preview</p></div>
                <img id="preview-img" alt="Preview" />
              </div>
              <div id="batch-list" style={{display:'none'}}>
                <div style={{fontSize:'0.8rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.5rem'}}>Batch Files (<span id="batch-count">0</span>)</div>
                <div id="batch-items" style={{display:'flex',flexDirection:'column',gap:'0.4rem',maxHeight:'180px',overflowY:'auto'}}></div>
              </div>
            </div>
            <div className="settings-panel">
              <div className="setting-group">
                <span className="setting-label"><i className="ph ph-file-arrow-up"></i> Output Format</span>
                <div className="format-tabs" id="format-tabs">
                  {[{l:'JPG',f:'image/jpeg',e:'jpg'},{l:'PNG',f:'image/png',e:'png'},{l:'WebP',f:'image/webp',e:'webp'},{l:'PDF',f:'pdf',e:'pdf'},{l:'GIF',f:'image/gif',e:'gif'}].map(({l,f,e},i)=>(
                    <button key={e} className={`fmt-tab ${e.toLowerCase()}${i===0?' active':''}`} data-fmt={f} data-ext={e}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="divider"></div>
              <div className="setting-group" id="quality-group">
                <span className="setting-label"><i className="ph ph-sliders-horizontal"></i> Quality</span>
                <div className="slider-row">
                  <input type="range" id="sl-quality" min="1" max="100" defaultValue="85" />
                  <span className="slider-val" id="val-quality">85%</span>
                </div>
              </div>
              <div className="divider"></div>
              <div className="setting-group">
                <span className="setting-label"><i className="ph ph-database"></i> Target File Size (optional)</span>
                <div className="kb-input-row">
                  <input type="number" className="kb-input" id="target-kb" placeholder="e.g. 100" min="1" max="50000" />
                  <span className="kb-unit">KB</span>
                </div>
                <p style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>Leave empty to use quality slider only.</p>
              </div>
              <div className="divider"></div>
              <div className="setting-group">
                <span className="setting-label"><i className="ph ph-frame-corners"></i> Resize Dimensions</span>
                <div className="dim-row">
                  <input type="number" className="dim-input" id="dim-w" placeholder="Width px" min="1" max="8000" />
                  <span className="dim-sep">×</span>
                  <input type="number" className="dim-input" id="dim-h" placeholder="Height px" min="1" max="8000" />
                </div>
                <div className="toggle-row">
                  <span className="toggle-label">Keep aspect ratio</span>
                  <label className="toggle-switch">
                    <input type="checkbox" id="keep-ratio" defaultChecked />
                    <span className="toggle-track"></span>
                  </label>
                </div>
              </div>
              <div className="divider"></div>
              <div className="process-btn-wrap">
                <button className="btn primary-btn" id="btn-process" style={{width:'100%',justifyContent:'center'}}><i className="ph ph-gear"></i> Process &amp; Download</button>
                <div className="progress-bar-wrap" id="progress-wrap">
                  <div className="progress-track"><div className="progress-fill" id="progress-fill"></div></div>
                  <span className="progress-text" id="progress-text">Processing…</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Result */}
          <div id="view-result" className="view-section">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'0.75rem',marginBottom:'1.5rem'}}>
              <div>
                <h2 style={{fontSize:'1.2rem',fontWeight:700}}>All Done!</h2>
                <p style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>Processed entirely on your device — nothing was sent anywhere.</p>
              </div>
              <button className="btn secondary-btn" id="btn-convert-another"><i className="ph ph-plus"></i> Convert Another</button>
            </div>
            <div className="result-grid" id="result-grid">
              {[{label:'Original',icon:'ph-image',color:'var(--primary)',imgId:'orig-img',sizeId:'orig-size',dimsId:'orig-dims',fmtId:'orig-fmt',thirdLabel:'Format'},{label:'Converted',icon:'ph-check-circle',color:'var(--success)',imgId:'conv-img',sizeId:'conv-size',dimsId:'conv-dims',fmtId:'conv-reduction',thirdLabel:'Reduction'}].map(({label,icon,color,imgId,sizeId,dimsId,fmtId,thirdLabel})=>(
                <div className="result-card" key={label}>
                  <div className="result-card-header"><i className={`ph ${icon}`} style={{color}}></i> {label}</div>
                  <div className="result-preview" id={label==='Converted'?'conv-preview':'orig-preview'}><img id={imgId} alt={label} /></div>
                  <div className="result-stats">
                    <div className="result-stat"><span className="result-stat-label">Size</span><span className="result-stat-val" id={sizeId}>—</span></div>
                    <div className="result-stat"><span className="result-stat-label">Dimensions</span><span className="result-stat-val" id={dimsId}>—</span></div>
                    <div className="result-stat"><span className="result-stat-label">{thirdLabel}</span><span className={`result-stat-val${label==='Converted'?' stat-green':''}`} id={fmtId}>—</span></div>
                  </div>
                </div>
              ))}
            </div>
            <div id="batch-result-wrap" style={{display:'none',marginBottom:'1.5rem'}}>
              <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.75rem'}}>Batch Results</div>
              <div className="batch-table-wrap">
                <table className="batch-table">
                  <thead><tr><th>File</th><th>Original</th><th>Converted</th><th>Reduction</th><th>Status</th></tr></thead>
                  <tbody id="batch-table-body"></tbody>
                </table>
              </div>
            </div>
            <div className="result-action-row">
              <button className="btn success-btn" id="btn-download"><i className="ph ph-download-simple"></i> Download File</button>
              <button className="btn success-btn" id="btn-download-zip" style={{display:'none'}}><i className="ph ph-file-zip"></i> Download All (ZIP)</button>
              <button className="btn secondary-btn" id="btn-back-configure"><i className="ph ph-arrow-left"></i> Back to Settings</button>
            </div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'1rem'}} className="animate-fade-in">
          {[
            {icon:'ph-lock-key',title:'Zero Upload Policy',desc:'Every file stays on your device. Nothing is transmitted to any server — not even anonymised metadata.'},
            {icon:'ph-target',title:'Exact KB Targeting',desc:'Need a file under 100 KB? Enter the target and let the tool binary-search the optimal quality automatically.'},
            {icon:'ph-stack',title:'Bulk Conversion',desc:'Select multiple files at once and download them all packaged in a single ZIP — one click, done.'},
            {icon:'ph-cloud-slash',title:'No Internet Needed',desc:'After the first load, this tool works with zero connectivity. Reliable on the move.'}
          ].map(({icon,title,desc})=>(
            <div className="glass-panel" key={title} style={{padding:'1.25rem',display:'flex',alignItems:'flex-start',gap:'0.75rem'}}>
              <i className={`ph ${icon}`} style={{fontSize:'1.5rem',color:'var(--primary)',flexShrink:0,marginTop:'0.1rem'}}></i>
              <div>
                <strong style={{fontSize:'0.875rem'}}>{title}</strong>
                <p style={{fontSize:'0.78rem',color:'var(--text-muted)',marginTop:'0.2rem',lineHeight:1.5}}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
