import React, { useEffect, useRef } from 'react'
import { removeBackground } from '@imgly/background-removal'
import Navbar from '../components/Navbar'
import '../styles/passport-photo.css'

export default function PassportPhotoMaker() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const $ = id => document.getElementById(id)
    const state = {
      originalImageUrl: null,
      processedImageUrl: null,
      cropper: null,
      bgColor: '#ffffff',
      borderColor: '#cccccc',
      borderWidth: 1,
      photoW: 3, photoH: 4,
      paperW: 21, paperH: 29.7,
      copies: 4,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      sharpness: 20,
      softness: 0,
      warmth: 0,
      gap: 0.3,
      margin: 0.5,
      step: 1,
      activeTool: 'tool-dimensions',
      baseZoom: null,
      multiPhotos: []   // Array of { canvas, label } for multi-photo mode
    }

    // ── Toast ─────────────────────────────────────────────────────────
    function showToast(msg, type = 'info') {
      const icons = { success: 'ph-check-circle', error: 'ph-x-circle', info: 'ph-info' }
      const t = document.createElement('div')
      t.className = `toast ${type}`
      t.innerHTML = `<i class="ph ${icons[type]}"></i><span>${msg}</span>`
      const container = $('toast-container')
      if (container) container.appendChild(t)
      setTimeout(() => t.remove(), 4000)
    }

    // ── Navigation & Tools ──────────────────────────────────────────────
    function goToStep(n) {
      state.step = n
      ;['step-1-btn', 'step-2-btn'].forEach((id, i) => {
        const el = $(id); if (!el) return
        el.classList.remove('active', 'done')
        if (i + 1 < n) el.classList.add('done')
        else if (i + 1 === n) el.classList.add('active')
      })
      $('view-upload').style.display = n === 1 ? 'block' : 'none'
      $('view-studio').style.display = n === 2 ? 'block' : 'none'
      if (n === 2) {
        // Need to wait for display to register before rendering preview
        setTimeout(renderLivePreview, 100)
      }
    }

    function setActiveTool(toolId) {
      document.querySelectorAll('.tool-grid-btn').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.tool-panel').forEach(p => p.style.display = 'none')
      const btn = $(`btn-${toolId}`)
      const panel = $(`panel-${toolId}`)
      if (btn) btn.classList.add('active')
      if (panel) panel.style.display = 'block'
      state.activeTool = toolId
    }

    document.querySelectorAll('.tool-grid-btn').forEach(btn => {
      btn.onclick = () => {
        const toolId = btn.id.replace('btn-', '')
        setActiveTool(toolId)
      }
    })

    // ── File Upload ───────────────────────────────────────────────────
    const fileInput = $('file-input')
    const uploadBtn = $('upload-btn')
    const dropZone = $('upload-zone')

    uploadBtn.onclick = () => fileInput.click()
    dropZone.onclick = (e) => { if (e.target !== uploadBtn) fileInput.click() }
    dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('drag-over') }
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over')
    dropZone.ondrop = e => {
      e.preventDefault(); dropZone.classList.remove('drag-over')
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
    }
    fileInput.onchange = e => {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0])
    }

    function handleFile(file) {
      if (!file.type.match('image.*')) { showToast('Please upload an image file.', 'error'); return }
      if (file.size > 15 * 1024 * 1024) { showToast('File too large (max 15MB).', 'error'); return }
      const reader = new FileReader()
      reader.onload = e => {
        state.originalImageUrl = e.target.result
        state.processedImageUrl = null
        loadImageIntoEditor(state.originalImageUrl)
        goToStep(2)
        showToast('Photo uploaded successfully.', 'success')
      }
      reader.readAsDataURL(file)
    }

    // ── Editor & Cropper ──────────────────────────────────────────────
    function loadImageIntoEditor(url) {
      const img = $('cropper-img')
      img.src = url
      img.style.display = 'block'
      if (state.cropper) state.cropper.destroy()

      const ar = state.photoW / state.photoH
      state.cropper = new window.Cropper(img, {
        aspectRatio: ar,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.8,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready() {
          $('face-guide').classList.add('visible')
          const imgData = state.cropper.getImageData()
          state.baseZoom = imgData.width / imgData.naturalWidth
          if ($('sl-zoom')) { $('sl-zoom').value = 100; $('val-zoom').innerText = '100%' }
          renderLivePreview()
        },
        zoom(e) {
          if (state.baseZoom && $('sl-zoom')) {
            const pct = Math.round((e.detail.ratio / state.baseZoom) * 100)
            $('sl-zoom').value = pct
            if ($('val-zoom')) $('val-zoom').innerText = pct + '%'
          }
        },
        crop() {
          // Debounce preview rendering to keep it smooth
          if (state._cropTimeout) clearTimeout(state._cropTimeout)
          state._cropTimeout = setTimeout(renderLivePreview, 150)
        }
      })
    }

    function updateCropRatio() {
      if (state.cropper) {
        state.cropper.setAspectRatio(state.photoW / state.photoH)
        renderLivePreview()
      }
    }

    // Sync the cropper editor's visible background to the selected colour
    // so the user sees the bg colour in the editor, not just the live preview.
    function syncCropperBg(color) {
      const container = document.querySelector('.cropper-canvas')
      if (container) {
        // Show selected color behind the transparent photo
        container.style.background = color
      }
      // Also update the wrap
      const wrap = document.querySelector('.cropper-wrap-box')
      if (wrap) wrap.style.background = color
    }

    // ── Live Preview Sheet Generation ─────────────────────────────────
    function renderLivePreview() {
      const pc = $('output-canvas')
      if (pc) renderCanvas(pc, 96)
    }

    function renderCanvas(targetCanvas, DPI) {
      if (!state.cropper) return
      if (!targetCanvas) return

      // We want the cropped canvas to be high-res enough for 300 DPI print if needed.
      // At 300 DPI, 2 inches (5cm) is 600px.
      // We'll crop at 1200px width so it is crystal clear even at 300 DPI.
      const primaryCanvas = state.cropper.getCroppedCanvas({
        width: 1200,
        height: Math.round(1200 * state.photoH / state.photoW)
      })
      if (!primaryCanvas) return

      // Build list of canvases — primary first, then additional people
      const photoSources = [primaryCanvas, ...state.multiPhotos.map(p => p.canvas)]

      // Sync the cropper editor background colour so the user sees it in the editor
      if (targetCanvas.id === 'output-canvas') {
        syncCropperBg(state.bgColor)
      }

      const CM_TO_PX = DPI / 2.54
      const pW = Math.round(state.paperW * CM_TO_PX); const pH = Math.round(state.paperH * CM_TO_PX)
      const photoW = Math.round(state.photoW * CM_TO_PX); const photoH = Math.round(state.photoH * CM_TO_PX)
      const margin = Math.round(state.margin * CM_TO_PX); const gap = Math.round(state.gap * CM_TO_PX)
      
      const cols = Math.floor((pW - 2 * margin + gap) / (photoW + gap)); 
      const rows = Math.floor((pH - 2 * margin + gap) / (photoH + gap))

      // FCFS: each person gets `state.copies` slots sequentially
      const queue = []
      photoSources.forEach(src => {
        for (let i = 0; i < state.copies; i++) queue.push(src)
      })
      const totalSlots = queue.length
      
      targetCanvas.width = pW; targetCanvas.height = pH
      const ctx = targetCanvas.getContext('2d')
      
      // Draw paper background (white sheet)
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, pW, pH)
      
      let count = 0
      outer: for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (count >= totalSlots) break outer
          const x = margin + c * (photoW + gap); const y = margin + r * (photoH + gap)
          
          const srcCanvas = queue[count]
          
          // 1. Draw the selected background color
          if (state.bgColor && state.bgColor !== 'transparent') {
            ctx.fillStyle = state.bgColor
            ctx.fillRect(x, y, photoW, photoH)
          }

          // 2. Image with colour/light filters
          let filterStr = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`
          if (state.warmth > 0) filterStr += ` sepia(${state.warmth}%)`
          else if (state.warmth < 0) filterStr += ` hue-rotate(${Math.abs(state.warmth)}deg)`
          if (state.softness > 0) filterStr += ` blur(${state.softness / 20}px)`
          
          ctx.filter = filterStr
          ctx.drawImage(srcCanvas, x, y, photoW, photoH)
          ctx.filter = 'none'
          
          // 3. Border
          if (state.borderWidth > 0) { 
            // Scale border width to DPI (if UI border is meant for 96 DPI screen, scale to target DPI)
            ctx.strokeStyle = state.borderColor; 
            ctx.lineWidth = Math.max(1, Math.round(state.borderWidth * (DPI / 96))); 
            ctx.strokeRect(x, y, photoW, photoH) 
          }
          
          // 4. Stamps
          const nameVal = $('stamp-name') ? $('stamp-name').value.trim() : ''
          if (nameVal) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x, y + photoH - 20, photoW, 20)
            ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(photoW * 0.065)}px Inter,sans-serif`; ctx.textAlign = 'center'
            ctx.fillText(nameVal, x + photoW / 2, y + photoH - 6); ctx.textAlign = 'left'
          }
          if ($('stamp-date') && $('stamp-date').checked) {
            const dateStr = new Date().toLocaleDateString('en-IN')
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = `${Math.round(photoW * 0.055)}px Inter,sans-serif`
            ctx.textAlign = 'right'; ctx.fillText(dateStr, x + photoW - 5, y + photoH - 5); ctx.textAlign = 'left'
          }
          count++
        }
      }
      
      // Footer text
      const peopleCount = photoSources.length
      ctx.fillStyle = '#94a3b8'; ctx.font = '10px Inter,sans-serif'
      ctx.fillText(`Amrit Enterprises Studio • ${state.photoW}×${state.photoH}cm • ${count} photos${peopleCount > 1 ? ` (${peopleCount} people × ${state.copies} each)` : ''}`, margin, pH - margin + 14)
      
      // Update status bar
      if ($('status-paper')) $('status-paper').innerText = `${state.paperW}×${state.paperH}cm`
      if ($('status-count')) $('status-count').innerText = `${count} Photos`
      if ($('status-size')) $('status-size').innerText = `${state.photoW}×${state.photoH}cm`
    }



    // ── Dimensions Panel ──────────────────────────────────────────────
    document.querySelectorAll('#size-presets .preset-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#size-presets .preset-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        const w = parseFloat(btn.dataset.w); const h = parseFloat(btn.dataset.h)
        if (w === 0) { $('custom-size-row').style.display = 'flex' }
        else {
          $('custom-size-row').style.display = 'none'
          state.photoW = w; state.photoH = h
          updateCropRatio()
        }
      }
    })
    const updateCustomSize = () => {
      const cw = parseFloat($('custom-w').value); const ch = parseFloat($('custom-h').value)
      if (cw > 0 && ch > 0) { state.photoW = cw; state.photoH = ch; updateCropRatio() }
    }
    if($('custom-w')) $('custom-w').oninput = updateCustomSize
    if($('custom-h')) $('custom-h').oninput = updateCustomSize

    // ── Position & Transform Panel ────────────────────────────────────
    if($('btn-rot-left')) $('btn-rot-left').onclick = () => { if (state.cropper) { state.cropper.rotate(-90); renderLivePreview() } }
    if($('btn-rot-right')) $('btn-rot-right').onclick = () => { if (state.cropper) { state.cropper.rotate(90); renderLivePreview() } }
    let flipH = 1; if($('btn-flip-h')) $('btn-flip-h').onclick = () => { if (state.cropper) { flipH *= -1; state.cropper.scaleX(flipH); renderLivePreview() } }
    let flipV = 1; if($('btn-flip-v')) $('btn-flip-v').onclick = () => { if (state.cropper) { flipV *= -1; state.cropper.scaleY(flipV); renderLivePreview() } }
    if($('sl-zoom')) $('sl-zoom').oninput = e => { 
      $('val-zoom').innerText = e.target.value + '%'
      if (state.cropper && state.baseZoom) { 
        state.cropper.zoomTo(state.baseZoom * (e.target.value / 100)); 
        renderLivePreview() 
      }
    }

    // ── Color & Lighting Panel ────────────────────────────────────────
    document.querySelectorAll('#bg-colors .color-swatch:not(.custom)').forEach(sw => {
      sw.onclick = async () => {
        document.querySelectorAll('#bg-colors .color-swatch').forEach(b => b.classList.remove('active'))
        sw.classList.add('active')
        state.bgColor = sw.dataset.color
        
        // Auto-remove background if user selects a color but the image is still opaque
        if (state.bgColor !== '#ffffff' && !state.processedImageUrl && state.cropper) {
          showToast('Extracting subject to apply background...', 'info')
          await performAiBgRemoval()
        }
        renderLivePreview()
      }
    })
    const cp = $('custom-color-picker')
    if (cp) {
      cp.oninput = async e => {
        document.querySelectorAll('#bg-colors .color-swatch').forEach(b => b.classList.remove('active'))
        cp.parentElement.classList.add('active')
        state.bgColor = e.target.value; cp.parentElement.style.background = e.target.value
        
        if (state.bgColor !== '#ffffff' && !state.processedImageUrl && state.cropper) {
          showToast('Extracting subject to apply background...', 'info')
          await performAiBgRemoval()
        }
        renderLivePreview()
      }
      cp.parentElement.onclick = () => cp.click()
    }

    ;['brightness', 'contrast', 'saturation', 'sharpness'].forEach(id => {
      const sl = $(`sl-${id}`); const val = $(`val-${id}`)
      if (sl) sl.oninput = e => { val.innerText = e.target.value; state[id] = parseInt(e.target.value); renderLivePreview() }
    })

    // ── Smart Retouch Panel ───────────────────────────────────────────
    if($('sl-softness')) $('sl-softness').oninput = e => { $('val-softness').innerText = e.target.value; state.softness = parseInt(e.target.value); renderLivePreview() }
    if($('sl-warmth')) $('sl-warmth').oninput = e => { $('val-warmth').innerText = e.target.value; state.warmth = parseInt(e.target.value); renderLivePreview() }
    if($('btn-auto-enhance')) $('btn-auto-enhance').onclick = () => {
      $('sl-brightness').value = 110; $('val-brightness').innerText = '110'; state.brightness = 110
      $('sl-contrast').value = 105; $('val-contrast').innerText = '105'; state.contrast = 105
      $('sl-saturation').value = 115; $('val-saturation').innerText = '115'; state.saturation = 115
      $('sl-softness').value = 10; $('val-softness').innerText = '10'; state.softness = 10
      renderLivePreview()
      showToast('Auto-enhance applied successfully', 'success')
    }

    // ── Spacing Panel ─────────────────────────────────────────────────
    if($('sl-gap')) $('sl-gap').oninput = e => { $('val-gap').innerText = e.target.value + 'mm'; state.gap = parseInt(e.target.value) / 10; renderLivePreview() }
    if($('sl-margin')) $('sl-margin').oninput = e => { $('val-margin').innerText = e.target.value + 'mm'; state.margin = parseInt(e.target.value) / 10; renderLivePreview() }

    // ── Multi-Photo Panel ─────────────────────────────────────────────
    function refreshMultiPhotoList() {
      const list = $('multi-photo-list'); if (!list) return
      list.innerHTML = ''

      // First thumbnail = the primary photo
      const primaryThumb = document.createElement('div')
      primaryThumb.className = 'multi-thumb primary'
      primaryThumb.innerHTML = `
        <img src="${state.processedImageUrl || state.originalImageUrl}" />
        <span class="multi-thumb-label">Photo 1<br/><small>(Primary)</small></span>
      `
      list.appendChild(primaryThumb)

      // Additional photos
      state.multiPhotos.forEach((p, idx) => {
        const div = document.createElement('div')
        div.className = 'multi-thumb'
        const thumbUrl = p.canvas.toDataURL('image/jpeg', 0.5)
        div.innerHTML = `
          <img src="${thumbUrl}" />
          <span class="multi-thumb-label">Photo ${idx + 2}</span>
          <button class="multi-thumb-remove" data-idx="${idx}"><i class="ph ph-x"></i></button>
        `
        div.querySelector('.multi-thumb-remove').onclick = (e) => {
          state.multiPhotos.splice(idx, 1)
          refreshMultiPhotoList()
          updateMultiStatus()
          renderLivePreview()
        }
        list.appendChild(div)
      })
    }

    function updateMultiStatus() {
      const status = $('multi-photo-status')
      if (!status) return
      const total = state.multiPhotos.length + 1
      if (total > 1) {
        status.innerHTML = `<span style="color:#10b981"><i class="ph ph-check-circle"></i> ${total} people · photos will alternate across the sheet</span>`
      } else {
        status.innerHTML = `<span style="color:rgba(255,255,255,0.4)">Add people below to mix different faces on one sheet</span>`
      }
    }

    const multiInput = $('multi-file-input')
    if ($('btn-add-photo')) {
      $('btn-add-photo').onclick = () => {
        if (!state.originalImageUrl) { showToast('Upload your first photo first!', 'error'); return }
        multiInput.click()
      }
    }
    if (multiInput) {
      multiInput.onchange = (e) => {
        const files = Array.from(e.target.files)
        if (!files.length) return
        let processed = 0
        files.forEach(file => {
          const reader = new FileReader()
          reader.onload = ev => {
            const img = new Image()
            img.onload = () => {
              // Auto-crop to the current aspect ratio
              const ar = state.photoW / state.photoH
              const imgAr = img.width / img.height
              let sx, sy, sw, sh
              if (imgAr > ar) { sh = img.height; sw = sh * ar; sx = (img.width - sw) / 2; sy = 0 }
              else { sw = img.width; sh = sw / ar; sx = 0; sy = (img.height - sh) / 2 }
              const c = document.createElement('canvas')
              c.width = 600; c.height = Math.round(600 / ar)
              c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
              state.multiPhotos.push({ canvas: c })
              processed++
              if (processed === files.length) {
                refreshMultiPhotoList()
                updateMultiStatus()
                renderLivePreview()
                showToast(`${processed} photo(s) added to sheet!`, 'success')
              }
            }
            img.src = ev.target.result
          }
          reader.readAsDataURL(file)
        })
        multiInput.value = '' // reset so same file can be re-added
      }
    }
    // Init multi-photo list
    refreshMultiPhotoList()
    updateMultiStatus()

    // ── AI Background Removal ─────────────────────────────────────────
    $('btn-remove-bg').onclick = () => performAiBgRemoval()

    async function performAiBgRemoval() {
      const srcUrl = state.processedImageUrl || state.originalImageUrl
      if (!srcUrl) { showToast('Please upload a photo first.', 'error'); return }
      const processing = $('ai-processing')
      if (processing) processing.classList.add('visible')
      try {
        const blob = await fetch(srcUrl).then(r => r.blob())
        const resultBlob = await removeBackground(blob, { 
          model: 'small', 
          output: { format: 'image/png', quality: 0.9 }
        })
        const url = URL.createObjectURL(resultBlob)
        state.processedImageUrl = url
        loadImageIntoEditor(url)
        showToast('Background removed successfully!', 'success')
      } catch (err) {
        console.error('BG Removal failed:', err)
        showToast('Failed to remove background. Please try again.', 'error')
      } finally {
        if (processing) processing.classList.remove('visible')
      }
    }

    // ── Print Sheet Panel ─────────────────────────────────────────────
    document.querySelectorAll('#print-options .preset-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#print-options .preset-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        state.paperW = parseFloat(btn.dataset.pw); state.paperH = parseFloat(btn.dataset.ph)
        renderLivePreview()
      }
    })
    $('copies-minus').onclick = () => { if (state.copies > 1) { state.copies--; $('copies-val').innerText = state.copies; renderLivePreview() } }
    $('copies-plus').onclick = () => { if (state.copies < 40) { state.copies++; $('copies-val').innerText = state.copies; renderLivePreview() } }

    // ── Identity & Border Panel ───────────────────────────────────────
    if($('sl-border')) $('sl-border').oninput = e => { $('val-border').innerText = e.target.value; state.borderWidth = parseInt(e.target.value); renderLivePreview() }
    document.querySelectorAll('#border-colors .color-swatch').forEach(sw => {
      sw.onclick = () => {
        document.querySelectorAll('#border-colors .color-swatch').forEach(b => b.classList.remove('active'))
        sw.classList.add('active'); state.borderColor = sw.dataset.color; renderLivePreview()
      }
    })
    if($('stamp-name')) $('stamp-name').oninput = renderLivePreview
    if($('stamp-date')) $('stamp-date').onchange = renderLivePreview


    // ── Final Download ────────────────────────────────────────────────
    $('btn-download-png').onclick = () => {
      if (!state.cropper) { showToast('No image to export.', 'error'); return }
      const exportCanvas = document.createElement('canvas')
      renderCanvas(exportCanvas, 300)
      const link=document.createElement('a'); link.download='AmritEnterprises-passport-photos.png'
      link.href=exportCanvas.toDataURL('image/png'); link.click()
      showToast('PNG downloaded!','success')
    }
    
    $('btn-download-pdf').onclick = () => {
      if (!state.cropper) { showToast('No image to export.', 'error'); return }
      showToast('Generating high-resolution PDF...', 'info')
      // Yield thread so toast renders
      setTimeout(() => {
        const exportCanvas = document.createElement('canvas')
        renderCanvas(exportCanvas, 300)
        const {jsPDF}=window.jspdf
        const pdf=new jsPDF({orientation:state.paperH>state.paperW?'portrait':'landscape',unit:'cm',format:[state.paperW,state.paperH]})
        
        // Use PNG to ensure zero compression/lossless quality as requested
        pdf.addImage(exportCanvas.toDataURL('image/png'),'PNG',0,0,state.paperW,state.paperH, '', 'NONE')
        pdf.save('AmritEnterprises-passport-photos.pdf')
        showToast('PDF downloaded!','success')
      }, 10)
    }
    
    $('btn-change-photo').onclick = () => {
      if (state.cropper) { state.cropper.destroy(); state.cropper = null }
      $('cropper-img').style.display = 'none'
      $('face-guide').classList.remove('visible')
      goToStep(1)
    }

    // Initialize Default Tool Panel
    setActiveTool('dimensions')

  }, [])

  return (
    <>
      <Navbar />
      <div className="toast-container" id="toast-container"></div>

      {/* ─── Full-width dark studio header ─── */}
      <div className="studio-header">
        <div className="studio-glare"></div>
        <div className="studio-header-inner">
          <div className="studio-title-block">
            <span className="studio-badge">
              <i className="ph ph-shield-check"></i> On-Device AI · Zero Uploads
            </span>
            <h1>Passport &amp; Visa<br /><em>Photo Studio</em></h1>
            <p>Instant, government-compliant photos from your browser. AI lifts backgrounds on-device — your images never touch a server.</p>
          </div>
          <div className="studio-steps">
            <div className="studio-step active" id="step-1-btn">
              <span className="sstep-num">01</span>
              <span className="sstep-label">Upload</span>
            </div>
            <div className="sstep-line"></div>
            <div className="studio-step" id="step-2-btn">
              <span className="sstep-num">02</span>
              <span className="sstep-label">Studio Editor</span>
            </div>
          </div>
        </div>
      </div>

      <div className="studio-workspace">
        
        {/* VIEW: UPLOAD */}
        <div className="view-upload" id="view-upload">
          <div className="studio-upload-zone" id="upload-zone">
            <i className="ph ph-cloud-arrow-up upload-icon"></i>
            <h3>Drop your photo here</h3>
            <p>JPG, PNG or WEBP &nbsp;·&nbsp; Max 15 MB</p>
            <button className="upload-btn" id="upload-btn">
              <i className="ph ph-folder-open"></i> Choose Photo
            </button>
            <input type="file" id="file-input" accept="image/jpeg,image/png,image/webp" />
          </div>
          <div className="studio-tips">
            {[
              {icon:'ph-lock-simple',h:'100% Private',b:'Files stay in your browser only'},
              {icon:'ph-cpu',h:'On-Device AI',b:'Background removed locally'},
              {icon:'ph-globe-hemisphere-east',h:'50+ Presets',b:'India, USA, UAE, UK & more'},
            ].map(({icon,h,b}) => (
              <div className="tip-card" key={h}>
                <i className={`ph ${icon}`}></i>
                <strong>{h}</strong>
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* VIEW: 3-COLUMN STUDIO */}
        <div className="studio-3col" id="view-studio" style={{display: 'none'}}>
          
          {/* COL 1: EDITOR */}
          <div className="col-editor">
            <div className="col-header">
              <span className="col-title"><i className="ph ph-crop"></i> Align &amp; Crop</span>
              <button className="tool-btn-ghost" id="btn-change-photo" style={{padding:'0.4rem 0.8rem', fontSize:'0.7rem', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', cursor:'pointer'}}>
                <i className="ph ph-arrow-left"></i> Change Photo
              </button>
            </div>
            <div className="canvas-wrapper">
              <img id="cropper-img" alt="Crop" />
              
              {/* Face Guide SVG Overlay */}
              <div className="face-guide-overlay" id="face-guide">
                <svg className="face-guide-svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet">
                  {/* Oval for face */}
                  <ellipse cx="200" cy="240" rx="110" ry="140" className="face-guide-path" />
                  {/* Top Hairline */}
                  <line x1="160" y1="100" x2="240" y2="100" className="face-guide-line" />
                  <text x="200" y="90" className="face-guide-text">HAIRLINE</text>
                  {/* Center Eye Line */}
                  <line x1="80" y1="240" x2="320" y2="240" className="face-guide-line" />
                  {/* Bottom Chin Line */}
                  <line x1="170" y1="380" x2="230" y2="380" className="face-guide-line" />
                  <text x="200" y="400" className="face-guide-text">CHIN</text>
                </svg>
              </div>

              <div className="ai-processing" id="ai-processing">
                <div className="ai-spinner"></div>
                <p>Processing on device…</p>
                <span>Removing background</span>
              </div>
            </div>
          </div>

          {/* COL 2: LIVE PREVIEW */}
          <div className="col-preview">
            <div className="col-header">
              <span className="col-title"><i className="ph ph-images"></i> Live Sheet Preview</span>
            </div>
            <div className="preview-body">
              <canvas id="output-canvas"></canvas>
            </div>
            <div className="preview-status">
              <span className="status-pill"><i className="ph ph-file"></i> <span id="status-paper">A4</span></span>
              <span className="status-pill"><i className="ph ph-copy"></i> <span id="status-count">0 Photos</span></span>
              <span className="status-pill"><i className="ph ph-frame-corners"></i> <span id="status-size">3×4cm</span></span>
            </div>
          </div>

          {/* COL 3: TOOLS & ADJUSTMENTS */}
          <div className="col-tools">
            <div className="col-header" style={{background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
              <span className="col-title"><i className="ph ph-sliders"></i> Adjustments</span>
            </div>
            <div className="tools-body">
              
              <div className="tool-grid">
                {[
                  { id: 'dimensions', icon: 'ph-ruler', label: 'Dimensions' },
                  { id: 'position', icon: 'ph-arrows-out-cardinal', label: 'Position' },
                  { id: 'color', icon: 'ph-paint-bucket', label: 'Color & Light' },
                  { id: 'retouch', icon: 'ph-sparkle', label: 'Smart Retouch' },
                  { id: 'sheet', icon: 'ph-printer', label: 'Print Sheet' },
                  { id: 'spacing', icon: 'ph-rows', label: 'Spacing' },
                  { id: 'identity', icon: 'ph-fingerprint', label: 'Identity' },
                  { id: 'multiphoto', icon: 'ph-users', label: 'Multi-Photo' },
                ].map((t) => (
                  <div className="tool-grid-btn" id={`btn-${t.id}`} key={t.id}>
                    <i className={`ph ${t.icon}`}></i>
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>

              {/* PANELS */}
              
              {/* DIMENSIONS */}
              <div className="tool-panel active-panel" id="panel-dimensions">
                <span className="panel-title"><i className="ph ph-ruler"></i> Photo Dimensions</span>
                <div className="panel-content">
                  <div className="sb-presets" id="size-presets">
                    {[
                      {n:'Standard',s:'3×4 cm',w:3,h:4},{n:'Indian Passport',s:'3.5×4.5 cm',w:3.5,h:4.5},
                      {n:'US Passport',s:'2×2 inch',w:5.08,h:5.08},{n:'Aadhaar Card',s:'2.5×3 cm',w:2.5,h:3},
                      {n:'PAN Card',s:'2.5×3.5 cm',w:2.5,h:3.5},{n:'Visa Photo',s:'3.5×4.5 cm',w:3.5,h:4.5},
                      {n:'Stamp Size',s:'2×2.5 cm',w:2,h:2.5},
                    ].map(({n,s,w,h},i) => (
                      <button key={n} className={`preset-btn${i===0?' active':''}`} data-w={w} data-h={h} data-unit="cm">
                        <span className="preset-name">{n}</span><span className="preset-size">{s}</span>
                      </button>
                    ))}
                    <button className="preset-btn" data-w="0" data-h="0">
                      <span className="preset-name">Custom</span><span className="preset-size">Set size</span>
                    </button>
                  </div>
                  <div id="custom-size-row" style={{display:'none',gap:'0.5rem',alignItems:'center'}}>
                    <input type="number" id="custom-w" placeholder="W (cm)" min="1" max="20" step="0.1" className="sb-input" />
                    <span style={{color:'rgba(255,255,255,0.4)'}}>×</span>
                    <input type="number" id="custom-h" placeholder="H (cm)" min="1" max="20" step="0.1" className="sb-input" />
                  </div>
                </div>
              </div>

              {/* POSITION */}
              <div className="tool-panel active-panel" id="panel-position" style={{display:'none'}}>
                <span className="panel-title"><i className="ph ph-arrows-out-cardinal"></i> Position &amp; Transform</span>
                <div className="panel-content">
                  <div className="export-btn-row">
                    <button className="export-btn" id="btn-rot-left"><i className="ph ph-arrow-u-up-left"></i> Rotate Left</button>
                    <button className="export-btn" id="btn-rot-right"><i className="ph ph-arrow-u-up-right"></i> Rotate Right</button>
                  </div>
                  <div className="export-btn-row">
                    <button className="export-btn" id="btn-flip-h"><i className="ph ph-arrows-left-right"></i> Flip Horiz</button>
                    <button className="export-btn" id="btn-flip-v"><i className="ph ph-arrows-down-up"></i> Flip Vert</button>
                  </div>
                  <div className="slider-row">
                    <label>Zoom</label>
                    <input type="range" id="sl-zoom" min="50" max="300" defaultValue="100" />
                    <span className="slider-val" id="val-zoom">100%</span>
                  </div>
                </div>
              </div>

              {/* COLOR & LIGHT */}
              <div className="tool-panel active-panel" id="panel-color" style={{display:'none'}}>
                <span className="panel-title"><i className="ph ph-paint-bucket"></i> Background &amp; Lighting</span>
                <div className="panel-content">
                  <div className="sb-swatches" id="bg-colors">
                    {[
                      {c:'#ffffff',t:'White'},{c:'#4a90d9',t:'Blue'},{c:'#e8f0fe',t:'Light Blue'},
                      {c:'#dc2626',t:'Red'},{c:'#f0fdf4',t:'Soft Green'},{c:'#fafafa',t:'Off-White'},{c:'#1e293b',t:'Dark'},
                    ].map(({c,t},i) => (
                      <div key={c} className={`color-swatch${i===0?' active':''}`} data-color={c} style={{background:c}} title={t}></div>
                    ))}
                    <div className="color-swatch custom" title="Pick color">
                      <i className="ph ph-eyedropper"></i>
                      <input type="color" id="custom-color-picker" defaultValue="#6366f1" style={{display:'none'}} />
                    </div>
                  </div>
                  <div style={{height:'1px', background:'rgba(255,255,255,0.05)', margin:'0.25rem 0'}}></div>
                  {[
                    {id:'sl-brightness',vid:'val-brightness',label:'Brightness',min:50,max:150,def:100},
                    {id:'sl-contrast',vid:'val-contrast',label:'Contrast',min:50,max:150,def:100},
                    {id:'sl-saturation',vid:'val-saturation',label:'Saturation',min:0,max:200,def:100},
                    {id:'sl-sharpness',vid:'val-sharpness',label:'Sharpness',min:0,max:100,def:20},
                  ].map(({id,vid,label,min,max,def}) => (
                    <div className="slider-row" key={id}>
                      <label>{label}</label>
                      <input type="range" id={id} min={min} max={max} defaultValue={def} />
                      <span className="slider-val" id={vid}>{def}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SMART RETOUCH */}
              <div className="tool-panel active-panel" id="panel-retouch" style={{display:'none'}}>
                <span className="panel-title"><i className="ph ph-sparkle"></i> Smart Retouch</span>
                <div className="panel-content">
                  <div className="slider-row">
                    <label>Softness</label>
                    <input type="range" id="sl-softness" min="0" max="100" defaultValue="0" />
                    <span className="slider-val" id="val-softness">0</span>
                  </div>
                  <div className="slider-row">
                    <label>Warmth</label>
                    <input type="range" id="sl-warmth" min="-50" max="50" defaultValue="0" />
                    <span className="slider-val" id="val-warmth">0</span>
                  </div>
                  <button className="tool-btn tool-btn-accent" id="btn-auto-enhance" style={{marginTop: '0.5rem', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)'}}>
                    <i className="ph ph-magic-wand"></i> Auto Enhance
                  </button>
                </div>
              </div>

              {/* PRINT SHEET */}
              <div className="tool-panel active-panel" id="panel-sheet" style={{display:'none'}}>
                <span className="panel-title"><i className="ph ph-printer"></i> Print Sheet Layout</span>
                <div className="panel-content">
                  <div className="sb-presets" id="print-options">
                    {[
                      {p:'A4',pw:21,ph:29.7,s:'210×297mm'},{p:'A5',pw:14.8,ph:21,s:'148×210mm'},
                      {p:'4×6',pw:10.16,ph:15.24,s:'102×152mm'},{p:'Letter',pw:21.59,ph:27.94,s:'215×279mm'},
                    ].map(({p,pw,ph,s},i) => (
                      <button key={p} className={`preset-btn${i===0?' active':''}`} data-pw={pw} data-ph={ph}>
                        <span className="preset-name">{p}</span><span className="preset-size">{s}</span>
                      </button>
                    ))}
                  </div>
                  <div className="copies-row">
                    <span className="copies-label">Copies to print</span>
                    <div className="copies-ctrl">
                      <button className="copies-btn" id="copies-minus">−</button>
                      <span id="copies-val" style={{color:'#fff', fontWeight:700}}>4</span>
                      <button className="copies-btn" id="copies-plus">+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SPACING */}
              <div className="tool-panel active-panel" id="panel-spacing" style={{display:'none'}}>
                <span className="panel-title"><i className="ph ph-rows"></i> Grid Spacing</span>
                <div className="panel-content">
                  <div className="slider-row">
                    <label>Photo Gap</label>
                    <input type="range" id="sl-gap" min="0" max="20" defaultValue="3" />
                    <span className="slider-val" id="val-gap">3mm</span>
                  </div>
                  <div className="slider-row">
                    <label>Page Margin</label>
                    <input type="range" id="sl-margin" min="0" max="50" defaultValue="5" />
                    <span className="slider-val" id="val-margin">5mm</span>
                  </div>
                </div>
              </div>

              {/* IDENTITY */}
              <div className="tool-panel active-panel" id="panel-identity" style={{display:'none'}}>
                <span className="panel-title"><i className="ph ph-fingerprint"></i> Identity &amp; Border</span>
                <div className="panel-content">
                  <div className="slider-row">
                    <label>Border</label>
                    <input type="range" id="sl-border" min="0" max="10" defaultValue="1" />
                    <span className="slider-val" id="val-border">1</span>
                  </div>
                  <div className="sb-swatches" id="border-colors">
                    {[{c:'#cccccc',t:'Gray'},{c:'#000000',t:'Black'},{c:'#ffffff',t:'White'},{c:'#7c3aed',t:'Violet'}].map(({c,t},i) => (
                      <div key={c} className={`color-swatch${i===0?' active':''}`} data-color={c} style={{background:c}} title={t}></div>
                    ))}
                  </div>
                  <div style={{height:'1px', background:'rgba(255,255,255,0.05)', margin:'0.25rem 0'}}></div>
                  <input type="text" id="stamp-name" placeholder="Name Stamp (optional)" className="sb-input" />
                  <label style={{display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.75rem', color:'rgba(255,255,255,0.6)', cursor:'pointer'}}>
                    <input type="checkbox" id="stamp-date" style={{accentColor:'#f59e0b'}} /> Add Date Stamp
                  </label>
                </div>
              </div>

              {/* MULTI-PHOTO */}
              <div className="tool-panel active-panel" id="panel-multiphoto" style={{display:'none'}}>
                <span className="panel-title"><i className="ph ph-users"></i> Multi-Photo Mode</span>
                <div className="panel-content">
                  <div id="multi-photo-status" style={{fontSize:'0.72rem', lineHeight:1.5, marginBottom:'0.5rem', minHeight:'1.5rem'}}></div>
                  <button className="tool-btn tool-btn-accent" id="btn-add-photo">
                    <i className="ph ph-plus"></i> Add Person's Photo
                  </button>
                  <input
                    type="file"
                    id="multi-file-input"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    style={{display:'none'}}
                  />
                  <div
                    id="multi-photo-list"
                    style={{display:'flex', gap:'0.5rem', marginTop:'0.75rem', flexWrap:'wrap', alignItems:'flex-start'}}
                  ></div>
                </div>
              </div>

              {/* AI Background Removal is persistent below panels */}
              <button className="tool-btn tool-btn-accent" id="btn-remove-bg" style={{marginTop: '0.75rem'}}>
                <i className="ph ph-magic-wand"></i> Remove Background (AI)
              </button>

            </div>

            <div className="tools-footer">
              <span className="export-title">Export Final Sheet</span>
              <div className="export-btn-row">
                <button className="export-btn" id="btn-download-png"><i className="ph ph-image"></i> PNG</button>
                <button className="export-btn" id="btn-download-pdf"><i className="ph ph-file-pdf"></i> PDF</button>
              </div>
              <button className="btn-final" onClick={() => showToast('Click PNG or PDF to download your high-res print sheet', 'success')}>
                <i className="ph ph-download-simple"></i> Download / Print Final
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ─── FAQ ─── */}
      <div className="studio-faq-wrap">
        <div className="studio-faq-inner">
          <div className="faq-heading">
            <i className="ph ph-chat-circle-text"></i>
            <h2>Common Questions</h2>
          </div>
          <div className="faq-list">
            {[
              {q:'How does background removal work offline?',a:'We use a compact AI model running inside your browser via WebAssembly. It downloads once, then works fully offline — no data ever sent anywhere.'},
              {q:'Will my photos be accepted by passport authorities?',a:'Yes — if you took a clear, well-lit shot. Our presets match India, USA, UAE, UK, and 50+ standards. Always verify against the latest guidelines of your issuing authority.'},
              {q:'Can I use this for Aadhaar, PAN, or visa applications?',a:'Absolutely. Pick a preset or enter custom dimensions. The cropper locks the correct aspect ratio for each document type automatically.'},
              {q:'Is there any watermark on downloaded photos?',a:'No watermarks, ever. What you download is exactly what you hand to a print shop — clean, plain photos.'},
              {q:'What formats can I upload?',a:'JPG, PNG, and WEBP images up to 15 MB. Use a well-lit shot with the subject clearly visible against any background for best AI results.'},
            ].map(({q,a}) => (
              <div className="faq-item" key={q}>
                <div className="faq-question" onClick={(e)=>{ if(e.currentTarget.nextElementSibling.classList.contains('open')) e.currentTarget.nextElementSibling.classList.remove('open'); else e.currentTarget.nextElementSibling.classList.add('open') }}>
                  {q}<i className="ph ph-caret-down faq-icon"></i>
                </div>
                <div className="faq-answer">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
