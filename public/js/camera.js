/**
 * NovaScan — Module Caméra & OCR (v2 — Android compatible)
 *
 * Stratégie de fallback en 3 niveaux :
 *  1. getUserMedia (caméra live + OCR)  ← idéal desktop/Chromebook
 *  2. <input type=file capture=environment> ← capture photo native Android
 *  3. Galerie / import d'image existante ← dernier recours
 */

'use strict';

const NovaCamera = (() => {
  let stream = null;
  let worker = null;
  let isWorkerReady = false;
  let permissionDenied = false;

  // ── Éléments DOM ──────────────────────────────────────────────────────
  const video      = document.getElementById('camera-video');
  const canvas     = document.getElementById('camera-canvas');
  const progressBar = document.getElementById('ocr-bar-fill');
  const statusText  = document.getElementById('ocr-status');
  const ocrProgress = document.getElementById('ocr-progress');
  const btnStart    = document.getElementById('btn-start-camera');
  const btnCapture  = document.getElementById('btn-capture');
  const cameraFrame = document.querySelector('.camera-frame');

  // ── Tesseract worker ──────────────────────────────────────────────────
  async function initWorker() {
    if (worker && isWorkerReady) return worker;
    showStatus('Chargement du moteur OCR…', 5);
    worker = await Tesseract.createWorker('fra+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          showStatus(`Extraction : ${pct}%`, pct);
        }
      },
    });
    isWorkerReady = true;
    return worker;
  }

  function showStatus(msg, pct) {
    if (statusText)  statusText.textContent = msg;
    if (progressBar) progressBar.style.width = `${pct}%`;
  }

  // ── Vérifie le support et l'état de la permission ────────────────────
  async function checkCameraSupport() {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    // Permissions API (Chrome Android ≥ 86)
    if (navigator.permissions) {
      try {
        const status = await navigator.permissions.query({ name: 'camera' });
        if (status.state === 'denied') return 'denied';
        if (status.state === 'granted') return 'granted';
        return 'prompt';           // 'prompt' = on peut demander
      } catch {
        return 'unknown';
      }
    }
    return 'unknown';
  }

  // ── Démarre la caméra live (getUserMedia) ─────────────────────────────
  async function startCamera() {
    const support = await checkCameraSupport();

    if (support === 'denied' || permissionDenied) {
      // Permission définitivement refusée → mode photo natif
      switchToNativeCapture();
      return false;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      video.srcObject = stream;
      await video.play();

      video.classList.remove('hidden');
      btnStart.classList.add('hidden');
      btnCapture.classList.remove('hidden');
      hideCameraPermissionBanner();

      // Pré-charge le worker pendant que l'utilisateur cadre
      initWorker().catch(console.warn);
      return true;

    } catch (err) {
      console.error('Camera error:', err.name, err.message);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        permissionDenied = true;
        showCameraPermissionBanner();
        switchToNativeCapture();
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        window.showToast('Aucune caméra détectée', 'error');
        switchToNativeCapture();
      } else if (err.name === 'NotReadableError') {
        window.showToast('Caméra utilisée par une autre application', 'error');
      } else {
        window.showToast(`Caméra indisponible : ${err.message}`, 'error');
        switchToNativeCapture();
      }
      return false;
    }
  }

  // ── Bannière d'aide pour débloquer la permission ──────────────────────
  function showCameraPermissionBanner() {
    if (document.getElementById('camera-permission-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'camera-permission-banner';
    banner.style.cssText = `
      background:#1a1a18;color:#f5f0e8;
      border-radius:14px;padding:16px;
      display:flex;flex-direction:column;gap:10px;
      margin-top:8px;
      border-left:4px solid #c8e63c;
    `;
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:1.4rem">📷</span>
        <div>
          <div style="font-weight:700;font-size:.9rem;color:#c8e63c">Permission caméra refusée</div>
          <div style="font-size:.8rem;color:rgba(245,240,232,.7);margin-top:2px">
            Chrome Android bloque l'accès. Utilisez <strong>l'upload photo</strong> ci-dessous, ou réautorisez :
          </div>
        </div>
      </div>
      <ol style="font-size:.78rem;color:rgba(245,240,232,.8);padding-left:18px;line-height:1.8;margin:0">
        <li>Appuyez sur 🔒 dans la barre d'adresse Chrome</li>
        <li>Touchez <strong>Autorisations du site</strong></li>
        <li>Activez <strong>Caméra</strong> → Autoriser</li>
        <li>Rechargez la page</li>
      </ol>
      <button id="btn-dismiss-banner" style="
        background:rgba(200,230,60,.15);color:#c8e63c;
        border:1px solid rgba(200,230,60,.3);border-radius:8px;
        padding:8px;font-size:.8rem;font-weight:600;cursor:pointer;
      ">Compris, j'utilise l'upload →</button>
    `;

    const container = document.querySelector('.camera-container');
    container?.insertBefore(banner, container.firstChild);

    document.getElementById('btn-dismiss-banner')?.addEventListener('click', () => {
      banner.remove();
      // Bascule automatiquement sur l'onglet Texte
      document.querySelector('[data-tab="text"]')?.click();
    });
  }

  function hideCameraPermissionBanner() {
    document.getElementById('camera-permission-banner')?.remove();
  }

  // ── Mode capture photo native (input file) ────────────────────────────
  // Sur Android Chrome, capture="environment" ouvre directement l'appareil photo
  function switchToNativeCapture() {
    if (document.getElementById('native-capture-zone')) return;

    // Masque l'interface caméra live
    if (cameraFrame) cameraFrame.style.display = 'none';

    const zone = document.createElement('div');
    zone.id = 'native-capture-zone';
    zone.style.cssText = `
      display:flex;flex-direction:column;gap:12px;
      margin-bottom:8px;
    `;
    zone.innerHTML = `
      <div style="
        background:var(--cream);border-radius:14px;
        padding:20px;text-align:center;
        border:2px dashed var(--green-light);
      ">
        <div style="font-size:2.5rem;margin-bottom:8px">📸</div>
        <div style="font-weight:700;font-size:.95rem;color:var(--green-deep);margin-bottom:4px">
          Photographier l'étiquette
        </div>
        <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:16px">
          Ouvre directement l'appareil photo
        </div>

        <!-- Bouton principal : ouvre la caméra native Android -->
        <label for="input-camera-capture" style="
          display:flex;align-items:center;justify-content:center;gap:8px;
          background:var(--green-deep);color:var(--lime);
          border-radius:12px;padding:14px 20px;cursor:pointer;
          font-family:Syne,sans-serif;font-weight:700;font-size:.95rem;
          margin-bottom:10px;transition:all .15s;
        ">
          📷 Prendre une photo
        </label>
        <input id="input-camera-capture" type="file"
          accept="image/*" capture="environment"
          style="display:none" />

        <!-- Fallback : galerie -->
        <label for="input-gallery-pick" style="
          display:flex;align-items:center;justify-content:center;gap:8px;
          background:transparent;color:var(--green-deep);
          border:2px solid var(--green-deep);
          border-radius:12px;padding:12px 20px;cursor:pointer;
          font-family:Syne,sans-serif;font-weight:600;font-size:.88rem;
          transition:all .15s;
        ">
          🖼 Choisir depuis la galerie
        </label>
        <input id="input-gallery-pick" type="file"
          accept="image/*"
          style="display:none" />
      </div>

      <!-- Preview de l'image capturée -->
      <div id="capture-preview" style="display:none;border-radius:14px;overflow:hidden;position:relative">
        <img id="capture-img" style="width:100%;border-radius:14px;display:block" alt="Photo capturée"/>
        <div id="capture-ocr-overlay" style="
          display:none;position:absolute;inset:0;
          background:rgba(26,58,42,.85);
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
          border-radius:14px;
        ">
          <div style="width:40px;height:40px;border-radius:50%;border:3px solid rgba(200,230,60,.3);border-top-color:#c8e63c;animation:spin .8s linear infinite"></div>
          <div id="capture-ocr-status" style="color:#c8e63c;font-size:.9rem;font-weight:600">Extraction du texte…</div>
          <div style="width:200px;height:5px;background:rgba(200,230,60,.2);border-radius:99px;overflow:hidden">
            <div id="capture-ocr-bar" style="height:100%;background:#c8e63c;width:0%;transition:width .2s;border-radius:99px"></div>
          </div>
        </div>
      </div>
    `;

    const controls = document.querySelector('.camera-controls');
    controls?.parentNode.insertBefore(zone, controls);
    if (controls) controls.style.display = 'none';

    // ── Gestion des inputs ──
    function handleFileInput(file) {
      if (!file || !file.type.startsWith('image/')) {
        window.showToast('Fichier invalide — choisissez une image', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => processImageForOCR(e.target.result);
      reader.readAsDataURL(file);
    }

    document.getElementById('input-camera-capture')
      ?.addEventListener('change', (e) => handleFileInput(e.target.files[0]));

    document.getElementById('input-gallery-pick')
      ?.addEventListener('change', (e) => handleFileInput(e.target.files[0]));
  }

  // ── OCR sur image (base64 dataURL) ────────────────────────────────────
  async function processImageForOCR(dataUrl) {
    // Affiche la preview
    const preview = document.getElementById('capture-preview');
    const img     = document.getElementById('capture-img');
    const overlay = document.getElementById('capture-ocr-overlay');
    const status  = document.getElementById('capture-ocr-status');
    const bar     = document.getElementById('capture-ocr-bar');

    if (img) img.src = dataUrl;
    if (preview) preview.style.display = 'block';
    if (overlay) overlay.style.display = 'flex';

    function updateProgress(msg, pct) {
      if (status) status.textContent = msg;
      if (bar)    bar.style.width = `${pct}%`;
    }

    try {
      updateProgress('Chargement du moteur OCR…', 10);

      // Worker avec logger
      const ocr = await (async () => {
        if (worker && isWorkerReady) return worker;
        showStatus('Chargement OCR…', 5);
        worker = await Tesseract.createWorker('fra+eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pct = Math.round((m.progress || 0) * 100);
              updateProgress(`Extraction : ${pct}%`, pct);
              showStatus(`Extraction : ${pct}%`, pct);
            }
          },
        });
        isWorkerReady = true;
        return worker;
      })();

      updateProgress('Analyse de l\'image…', 20);
      ocrProgress?.classList.remove('hidden');

      const result = await ocr.recognize(dataUrl);
      const text = cleanOCRText(result.data.text || '');

      updateProgress('Terminé !', 100);

      // Masque overlay après 800ms
      setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
        ocrProgress?.classList.add('hidden');
      }, 800);

      if (!text || text.trim().length < 10) {
        window.showToast('Texte trop court — essayez une photo plus nette', 'error');
        return;
      }

      // Injecte dans le textarea et bascule sur l'onglet texte
      const textarea = document.getElementById('ingredients-raw');
      if (textarea) textarea.value = text;

      document.querySelector('[data-tab="text"]')?.click();
      window.showToast('Texte extrait — vérifiez et analysez !', 'success');

    } catch (err) {
      if (overlay) overlay.style.display = 'none';
      window.showToast(`Erreur OCR : ${err.message}`, 'error');
    }
  }

  // ── Capture live (caméra active) ──────────────────────────────────────
  async function captureAndRecognize() {
    if (!stream) throw new Error('Caméra non démarrée');

    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.putImageData(enhanceForOCR(imageData), 0, 0);

    ocrProgress?.classList.remove('hidden');
    showStatus('Préparation de l\'OCR…', 10);

    try {
      const ocr = await initWorker();
      showStatus('Analyse en cours…', 20);
      const result = await ocr.recognize(canvas);
      const text = result.data.text || '';
      showStatus('Extraction terminée !', 100);
      setTimeout(() => { ocrProgress?.classList.add('hidden'); showStatus('', 0); }, 1000);
      return cleanOCRText(text);
    } catch (err) {
      ocrProgress?.classList.add('hidden');
      throw new Error(`Erreur OCR : ${err.message}`);
    }
  }

  // ── Amélioration contraste pour OCR ──────────────────────────────────
  function enhanceForOCR(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      const c = Math.min(255, Math.max(0, 128 + (gray - 128) * 1.5));
      d[i] = d[i+1] = d[i+2] = c;
    }
    return imageData;
  }

  // ── Nettoyage texte OCR ───────────────────────────────────────────────
  function cleanOCRText(raw) {
    if (!raw) return '';
    let text = raw
      .replace(/\n{3,}/g, '\n\n')
      .replace(/([a-zéèêëàâùûüïî,])\n([a-zéèêëàâùûüïî])/gi, '$1 $2')
      .replace(/[—–]/g, '-')
      .replace(/  +/g, ' ')
      .replace(/[|\\\/\[\]{}]/g, '')
      .trim();

    const m = text.match(/ingr[eé]dients?\s*:?\s*([\s\S]{20,}?)(?:\n\n|valeurs?\s+nutritives?|nutri(?:tion)?|$)/i);
    if (m) text = m[1].trim();
    return text;
  }

  // ── Arrêt caméra ─────────────────────────────────────────────────────
  function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video) { video.srcObject = null; video.classList.add('hidden'); }
    if (btnStart)   btnStart.classList.remove('hidden');
    if (btnCapture) btnCapture.classList.add('hidden');
  }

  async function terminate() {
    if (worker) { await worker.terminate(); worker = null; isWorkerReady = false; }
    stopCamera();
  }

  // ── Bind bouton principal ─────────────────────────────────────────────
  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      btnStart.disabled = true;
      btnStart.textContent = 'Démarrage…';
      const ok = await startCamera();
      if (!ok) {
        btnStart.disabled = false;
        btnStart.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Activer la caméra`;
      }
    });
  }

  return { startCamera, stopCamera, captureAndRecognize, terminate, isActive: () => !!stream };
})();

window.NovaCamera = NovaCamera;
