/**
 * NovaScan — Module Caméra & OCR
 * Capture vidéo + extraction de texte via Tesseract.js
 */

'use strict';

const NovaCamera = (() => {
  let stream = null;
  let worker = null;
  let isWorkerReady = false;

  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const progressBar = document.getElementById('ocr-bar-fill');
  const statusText = document.getElementById('ocr-status');
  const ocrProgress = document.getElementById('ocr-progress');
  const btnStart = document.getElementById('btn-start-camera');
  const btnCapture = document.getElementById('btn-capture');

  /** Initialise le worker Tesseract (lazy loading) */
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
    if (statusText) statusText.textContent = msg;
    if (progressBar) progressBar.style.width = `${pct}%`;
  }

  /** Démarre la caméra */
  async function startCamera() {
    try {
      // Préférence caméra arrière sur mobile
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play();

      video.classList.remove('hidden');
      btnStart.classList.add('hidden');
      btnCapture.classList.remove('hidden');

      // Pré-init du worker pendant que l'utilisateur prépare le scan
      initWorker().catch(console.warn);

      return true;
    } catch (err) {
      console.error('Camera error:', err);
      let msg = 'Impossible d\'accéder à la caméra.';
      if (err.name === 'NotAllowedError') msg = 'Permission caméra refusée. Autorisez l\'accès dans les paramètres.';
      if (err.name === 'NotFoundError') msg = 'Aucune caméra détectée sur cet appareil.';
      throw new Error(msg);
    }
  }

  /** Arrête la caméra */
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
    video.classList.add('hidden');
    btnStart.classList.remove('hidden');
    btnCapture.classList.add('hidden');
  }

  /** Capture une frame et effectue l'OCR */
  async function captureAndRecognize() {
    if (!stream) throw new Error('Caméra non démarrée');

    // Capture la frame courante
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Amélioration du contraste pour l'OCR
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const enhanced = enhanceForOCR(imageData);
    ctx.putImageData(enhanced, 0, 0);

    // Affiche le progress
    ocrProgress.classList.remove('hidden');
    showStatus('Préparation de l\'OCR…', 10);

    try {
      const ocr = await initWorker();
      showStatus('Analyse en cours…', 20);

      const result = await ocr.recognize(canvas);
      const extractedText = result.data.text || '';

      showStatus('Extraction terminée !', 100);

      // Nettoyage après 1s
      setTimeout(() => {
        ocrProgress.classList.add('hidden');
        showStatus('', 0);
      }, 1000);

      return cleanOCRText(extractedText);

    } catch (err) {
      ocrProgress.classList.add('hidden');
      throw new Error(`Erreur OCR : ${err.message}`);
    }
  }

  /**
   * Améliore l'image pour l'OCR (grayscale + contraste)
   */
  function enhanceForOCR(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Grayscale
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Contraste (facteur 1.4)
      const contrast = 128 + (gray - 128) * 1.4;
      const clamped = Math.min(255, Math.max(0, contrast));
      data[i] = data[i + 1] = data[i + 2] = clamped;
    }
    return imageData;
  }

  /**
   * Nettoie le texte OCR pour extraire les ingrédients
   */
  function cleanOCRText(raw) {
    if (!raw) return '';

    let text = raw
      // Supprime les sauts de ligne multiples
      .replace(/\n{3,}/g, '\n\n')
      // Remplace les retours à la ligne isolés par des espaces (dans une liste continue)
      .replace(/([a-zéèêëàâùûüïî,])\n([a-zéèêëàâùûüïî])/gi, '$1 $2')
      // Corrige les tirets durs OCR
      .replace(/[—–]/g, '-')
      // Normalise les espaces multiples
      .replace(/  +/g, ' ')
      // Supprime les caractères parasites courants de l'OCR
      .replace(/[|\\\/\[\]{}]/g, '')
      .trim();

    // Tente de trouver la section "ingrédients" si présent
    const ingredientsMatch = text.match(
      /ingr[eé]dients?\s*:?\s*([\s\S]{20,}?)(?:\n\n|valeurs?\s+nutritives?|nutri(?:tion)?|$)/i
    );
    if (ingredientsMatch) {
      text = ingredientsMatch[1].trim();
    }

    return text;
  }

  /** Termine le worker Tesseract proprement */
  async function terminate() {
    if (worker) {
      await worker.terminate();
      worker = null;
      isWorkerReady = false;
    }
    stopCamera();
  }

  // Bind events
  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      try {
        btnStart.disabled = true;
        btnStart.textContent = 'Démarrage…';
        await startCamera();
      } catch (err) {
        window.showToast(err.message, 'error');
        btnStart.disabled = false;
        btnStart.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Activer la caméra`;
      }
    });
  }

  return {
    startCamera,
    stopCamera,
    captureAndRecognize,
    terminate,
    isActive: () => !!stream,
  };

})();

window.NovaCamera = NovaCamera;
