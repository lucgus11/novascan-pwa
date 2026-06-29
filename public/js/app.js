/**
 * NovaScan — Application principale
 * Orchestration : routing, état, analyses, historique, UI
 */

'use strict';

// ── État global ─────────────────────────────────────────────────────────────
const State = {
  currentPage: 'scan',
  isOnline: navigator.onLine,
  currentResult: null,   // Résultat de la dernière analyse
  currentProductId: null, // ID si produit sauvegardé
  groqApiKey: null,
  analyzingOverlay: null,
};

// ── Utilitaires UI ──────────────────────────────────────────────────────────

/** Affiche un toast de notification */
window.showToast = function(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span style="flex-shrink:0">${icons[type] || 'ℹ'}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 280);
  }, duration);
};

/** Overlay d'analyse */
function showAnalyzing(text = 'Analyse en cours…') {
  const overlay = document.createElement('div');
  overlay.className = 'analyzing-overlay';
  overlay.id = 'analyzing-overlay';
  overlay.innerHTML = `
    <div class="analyzing-spinner"></div>
    <p class="analyzing-text">${text}</p>
  `;
  document.body.appendChild(overlay);
  State.analyzingOverlay = overlay;
}
function hideAnalyzing() {
  const overlay = document.getElementById('analyzing-overlay');
  if (overlay) overlay.remove();
  State.analyzingOverlay = null;
}

// ── Navigation ──────────────────────────────────────────────────────────────

function navigateTo(pageId) {
  // Masque toutes les pages
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  // Active la bonne page
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.remove('hidden');

  // Met à jour la nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  State.currentPage = pageId;

  // Actions spécifiques aux pages
  if (pageId === 'history') loadHistory();
  if (pageId !== 'scan' && NovaCamera.isActive()) NovaCamera.stopCamera();
}

function showResultPage() {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-result').classList.remove('hidden');

  // On ne change pas la nav active — l'utilisateur est "dans" le scan
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === 'scan');
  });
}

// ── Connexion Internet ──────────────────────────────────────────────────────

function updateConnectionBadge() {
  State.isOnline = navigator.onLine;
  const badge = document.getElementById('connection-badge');
  if (!badge) return;

  if (State.isOnline) {
    badge.className = 'badge-online';
    badge.innerHTML = `<span class="badge-dot"></span><span class="badge-label">En ligne</span>`;
  } else {
    badge.className = 'badge-offline';
    badge.innerHTML = `<span class="badge-dot"></span><span class="badge-label">Hors-ligne</span>`;
  }
}

window.addEventListener('online', () => {
  updateConnectionBadge();
  showToast('Connexion rétablie — mode IA activé', 'success');
});
window.addEventListener('offline', () => {
  updateConnectionBadge();
  showToast('Hors-ligne — algorithme local actif', 'info');
});

// ── Analyse ─────────────────────────────────────────────────────────────────

/**
 * Analyse principale : choisit online (Groq) ou offline (local)
 */
async function analyzeIngredients(ingredientsText) {
  if (!ingredientsText || ingredientsText.trim().length < 5) {
    showToast('La liste d\'ingrédients est trop courte', 'error');
    return;
  }

  showAnalyzing(State.isOnline ? 'Analyse IA en cours…' : 'Analyse locale…');

  try {
    let result;

    if (State.isOnline && State.groqApiKey) {
      try {
        result = await GroqAPI.analyze(ingredientsText, State.groqApiKey);
        showToast('Analyse IA Groq effectuée', 'success');
      } catch (groqError) {
        console.warn('Groq failed, falling back to local:', groqError);
        showToast('IA indisponible — algorithme local utilisé', 'info');
        result = NovaLocal.analyze(ingredientsText);
      }
    } else {
      result = NovaLocal.analyze(ingredientsText);
      const mode = State.isOnline ? '(clé API non configurée)' : '(hors-ligne)';
      showToast(`Analyse locale ${mode}`, 'info');
    }

    State.currentResult = { ...result, ingredients: ingredientsText };
    State.currentProductId = null;

    hideAnalyzing();
    renderResult(result, ingredientsText);
    showResultPage();

  } catch (err) {
    hideAnalyzing();
    showToast(`Erreur : ${err.message}`, 'error');
  }
}

// ── Rendu du résultat ───────────────────────────────────────────────────────

function renderResult(result, ingredients) {
  if (!result) return;

  const { score, percent, novaClass, verdictShort, verdictLong, markers, positives, source, model } = result;

  // Score ring
  const RING_CIRCUMFERENCE = 490; // 2π × 78
  const ringFill = document.getElementById('ring-fill');
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;

  // Couleur dynamique selon score
  const color = result.color || NovaLocal.colorFromScore(score);
  ringFill.style.stroke = color;

  // Anime après un court délai (pour que la transition soit visible)
  setTimeout(() => {
    ringFill.style.strokeDashoffset = offset;
  }, 100);

  // Valeur score
  document.getElementById('score-value').textContent = score !== null ? score.toFixed(1) : '—';
  document.getElementById('score-percent').textContent = percent !== null ? `${percent}%` : '—';

  // Verdict
  document.getElementById('score-verdict').textContent = verdictLong || verdictShort || '';

  // Badge NOVA
  const badge = document.getElementById('nova-badge');
  badge.textContent = `NOVA ${novaClass || '—'}`;
  badge.className = `nova-badge ${novaClass ? `nova-${novaClass}` : ''}`;

  // Gauge de transformation (0% = brut, 100% = ultra)
  const transformLevel = 100 - (percent || 50);
  const gaugePercent = Math.max(2, Math.min(98, transformLevel));
  document.getElementById('gauge-fill').style.width = `${gaugePercent}%`;
  document.getElementById('gauge-cursor').style.left = `${gaugePercent}%`;

  // Source d'analyse
  const sourceEl = document.getElementById('analysis-source');
  if (source === 'online') {
    sourceEl.textContent = `🤖 Analysé par IA (${model || 'Groq'})`;
  } else {
    sourceEl.textContent = '⚡ Analysé par algorithme local NOVA';
  }

  // Marqueurs
  renderMarkers(markers || [], positives || []);

  // Pré-remplissage fiche
  document.getElementById('product-ingredients').value = ingredients || '';

  // Reset bouton sauvegarde
  const btnSave = document.getElementById('btn-save');
  btnSave.classList.remove('saved');
  btnSave.title = 'Sauvegarder ce produit';
}

function renderMarkers(markers, positives) {
  const list = document.getElementById('markers-list');
  list.innerHTML = '';

  if (!markers.length && !positives.length) {
    list.innerHTML = `
      <div class="no-markers">
        <div class="checkmark">✅</div>
        <p>Aucun marqueur d'ultra-transformation détecté</p>
      </div>`;
    return;
  }

  // Marqueurs négatifs
  for (const m of markers) {
    const icons = { high: '🔴', med: '🟠', low: '🟡' };
    const item = document.createElement('div');
    item.className = `marker-item severity-${m.severity || 'med'}`;
    item.innerHTML = `
      <span class="marker-icon">${icons[m.severity] || '🟡'}</span>
      <div class="marker-body">
        <div class="marker-name">${escapeHtml(m.name)}</div>
        ${m.desc ? `<div class="marker-desc">${escapeHtml(m.desc)}</div>` : ''}
        ${m.found ? `<div class="marker-desc" style="font-style:italic;margin-top:2px;">Trouvé : "${escapeHtml(m.found)}"</div>` : ''}
        <div class="marker-penalty">−${m.penalty || '?'} pts</div>
      </div>`;
    list.appendChild(item);
  }

  // Ingrédients positifs
  if (positives.length) {
    const pos = document.createElement('div');
    pos.className = 'marker-item';
    pos.style.borderLeftColor = '#2ecc71';
    pos.innerHTML = `
      <span class="marker-icon">🌿</span>
      <div class="marker-body">
        <div class="marker-name">Ingrédients positifs</div>
        <div class="marker-desc">${escapeHtml(positives.join(', '))}</div>
        <div class="marker-penalty" style="color:#2ecc71">Bonus qualité</div>
      </div>`;
    list.appendChild(pos);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Sauvegarde produit ──────────────────────────────────────────────────────

async function saveCurrentProduct() {
  if (!State.currentResult) {
    showToast('Aucun résultat à sauvegarder', 'error');
    return;
  }

  const productData = {
    // Fiche produit
    name: document.getElementById('product-name').value.trim() || 'Produit sans nom',
    store: document.getElementById('product-store').value.trim(),
    category: document.getElementById('product-category').value,
    ingredients: document.getElementById('product-ingredients').value.trim(),
    notes: document.getElementById('product-notes').value.trim(),

    // Résultat analyse
    score: State.currentResult.score,
    percent: State.currentResult.percent,
    novaClass: State.currentResult.novaClass,
    verdictShort: State.currentResult.verdictShort,
    verdictLong: State.currentResult.verdictLong,
    markers: State.currentResult.markers,
    positives: State.currentResult.positives,
    source: State.currentResult.source,
    color: State.currentResult.color,
    analyzedAt: State.currentResult.analyzedAt,
  };

  try {
    const saved = await NovaDB.saveProduct(productData);
    State.currentProductId = saved.id;

    const btnSave = document.getElementById('btn-save');
    btnSave.classList.add('saved');

    showToast(`"${productData.name}" sauvegardé !`, 'success');
  } catch (err) {
    showToast(`Erreur sauvegarde : ${err.message}`, 'error');
  }
}

// ── Historique ──────────────────────────────────────────────────────────────

async function loadHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  list.innerHTML = '';

  try {
    const products = await NovaDB.getAllProducts();

    if (!products.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    // Statistiques en haut
    const stats = await NovaDB.getStats();
    if (stats) {
      const statsEl = document.createElement('div');
      statsEl.style.cssText = 'background:var(--cream);border-radius:14px;padding:16px;margin-bottom:16px;display:flex;gap:16px;justify-content:space-around;';
      statsEl.innerHTML = `
        <div style="text-align:center">
          <div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.4rem;color:var(--green-deep)">${stats.total}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">Produits</div>
        </div>
        <div style="text-align:center">
          <div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.4rem;color:var(--green-deep)">${stats.avgScore}/10</div>
          <div style="font-size:.72rem;color:var(--text-muted)">Score moyen</div>
        </div>
        <div style="text-align:center">
          <div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.4rem;color:#2ecc71">${stats.byNova[1] + stats.byNova[2]}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">NOVA 1-2</div>
        </div>
        <div style="text-align:center">
          <div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.4rem;color:#e74c3c">${stats.byNova[4]}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">NOVA 4</div>
        </div>
      `;
      list.appendChild(statsEl);
    }

    for (const product of products) {
      const card = createHistoryCard(product);
      list.appendChild(card);
    }
  } catch (err) {
    showToast('Erreur chargement historique', 'error');
  }
}

function createHistoryCard(product) {
  const card = document.createElement('div');
  card.className = 'history-card';

  const novaColors = { 1: '#2ecc71', 2: '#f1c40f', 3: '#e67e22', 4: '#e74c3c' };
  const color = novaColors[product.novaClass] || '#8a8a7a';

  const date = new Date(product.savedAt);
  const dateStr = date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  card.innerHTML = `
    <div class="history-score" style="border-color:${color}">
      <span class="history-score-val" style="color:${color}">${product.score?.toFixed(1) || '—'}</span>
      <span class="history-score-max">/10</span>
    </div>
    <div class="history-body">
      <div class="history-name">${escapeHtml(product.name)}</div>
      <div class="history-meta">
        ${product.category ? escapeHtml(product.category) : ''}
        ${product.store ? ` · ${escapeHtml(product.store)}` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
        <span class="history-nova" style="background:${color}22;color:${color}">NOVA ${product.novaClass || '—'}</span>
        <span class="history-date">${dateStr}</span>
      </div>
    </div>
    <button class="history-delete" data-id="${product.id}" aria-label="Supprimer">🗑</button>
  `;

  // Clic pour réafficher le résultat
  card.addEventListener('click', (e) => {
    if (e.target.closest('.history-delete')) return;
    reloadHistoryProduct(product);
  });

  // Suppression
  card.querySelector('.history-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Supprimer "${product.name}" ?`)) return;
    try {
      await NovaDB.deleteProduct(product.id);
      card.remove();
      showToast('Produit supprimé', 'info');
      const remaining = document.querySelectorAll('.history-card');
      if (!remaining.length) document.getElementById('history-empty').classList.remove('hidden');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
  });

  return card;
}

function reloadHistoryProduct(product) {
  // Recrée un objet result à partir des données sauvegardées
  State.currentResult = {
    score: product.score,
    percent: product.percent,
    novaClass: product.novaClass,
    verdictShort: product.verdictShort,
    verdictLong: product.verdictLong,
    markers: product.markers || [],
    positives: product.positives || [],
    source: product.source,
    color: product.color || NovaLocal.colorFromScore(product.score),
    analyzedAt: product.analyzedAt,
    ingredients: product.ingredients,
  };
  State.currentProductId = product.id;

  renderResult(State.currentResult, product.ingredients);

  // Remplit la fiche
  document.getElementById('product-name').value = product.name || '';
  document.getElementById('product-store').value = product.store || '';
  document.getElementById('product-category').value = product.category || '';
  document.getElementById('product-notes').value = product.notes || '';

  // Marque comme déjà sauvegardé
  document.getElementById('btn-save').classList.add('saved');

  showResultPage();
}

// ── Recalcul à partir du formulaire ─────────────────────────────────────────

document.getElementById('btn-recalculate')?.addEventListener('click', async () => {
  const ingredients = document.getElementById('product-ingredients').value.trim();
  if (!ingredients) {
    showToast('La liste des ingrédients est vide', 'error');
    return;
  }

  showAnalyzing(State.isOnline ? 'Recalcul IA…' : 'Recalcul local…');

  try {
    let result;
    if (State.isOnline && State.groqApiKey) {
      try {
        result = await GroqAPI.analyze(ingredients, State.groqApiKey);
      } catch {
        result = NovaLocal.analyze(ingredients);
      }
    } else {
      result = NovaLocal.analyze(ingredients);
    }

    State.currentResult = { ...result, ingredients };
    State.currentProductId = null; // Le résultat a changé, on force re-sauvegarde

    hideAnalyzing();
    renderResult(result, ingredients);
    showToast('Score recalculé', 'success');

    // Si le produit était sauvegardé, propose de mettre à jour
    if (State.currentProductId) {
      // Mise à jour automatique en BDD
      await NovaDB.updateProduct(State.currentProductId, {
        score: result.score,
        percent: result.percent,
        novaClass: result.novaClass,
        verdictShort: result.verdictShort,
        verdictLong: result.verdictLong,
        markers: result.markers,
        positives: result.positives,
        ingredients,
      });
    }
  } catch (err) {
    hideAnalyzing();
    showToast(`Erreur : ${err.message}`, 'error');
  }
});

// ── Configuration API Key ────────────────────────────────────────────────────

async function loadApiKey() {
  try {
    // D'abord depuis localStorage (rapide)
    const local = localStorage.getItem('nova_groq_key');
    if (local) {
      State.groqApiKey = local;
      return;
    }
    // Puis depuis IndexedDB
    const stored = await NovaDB.getSetting('groqApiKey');
    if (stored) State.groqApiKey = stored;
  } catch (e) {
    // Non bloquant
  }
}

// ── Bindings événements ──────────────────────────────────────────────────────

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

// Retour depuis résultat
document.getElementById('btn-back-result')?.addEventListener('click', () => {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-scan').classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === 'scan');
  });
});

// Sauvegarde
document.getElementById('btn-save')?.addEventListener('click', saveCurrentProduct);

// Tabs scan
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.remove('hidden');
  });
});

// Capture caméra
document.getElementById('btn-capture')?.addEventListener('click', async () => {
  try {
    const text = await NovaCamera.captureAndRecognize();
    if (!text || text.trim().length < 10) {
      showToast('Texte extrait trop court — repositionnez la caméra', 'error');
      return;
    }
    // Pré-remplit le textarea texte pour vérification
    document.getElementById('ingredients-raw').value = text;
    // Bascule sur l'onglet texte pour vérification
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelector('[data-tab="text"]').classList.add('active');
    document.getElementById('tab-text').classList.remove('hidden');

    showToast('Texte extrait — vérifiez et analysez', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Analyse texte
document.getElementById('btn-analyze-text')?.addEventListener('click', () => {
  const text = document.getElementById('ingredients-raw').value.trim();
  analyzeIngredients(text);
});

// Effacer historique
document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
  if (!confirm('Effacer tout l\'historique ?')) return;
  try {
    await NovaDB.clearAllProducts();
    loadHistory();
    showToast('Historique effacé', 'info');
  } catch {
    showToast('Erreur lors de l\'effacement', 'error');
  }
});


// Paramètres
document.getElementById('btn-open-settings')?.addEventListener('click', () => {
  NovaSettings.openSettingsModal();
});

// ── Initialisation ───────────────────────────────────────────────────────────

async function init() {
  // Charge la clé API
  await loadApiKey();

  // Met à jour le badge connexion
  updateConnectionBadge();

  // Splash screen
  await new Promise(resolve => setTimeout(resolve, 1500));
  const splash = document.getElementById('splash');
  splash.classList.add('fade-out');
  setTimeout(() => {
    splash.style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
  }, 450);

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.warn);
  }

  // Affiche la page scan par défaut
  navigateTo('scan');

  // Si pas de clé API configurée, affiche un message discret
  if (!State.groqApiKey) {
    setTimeout(() => {
      showToast('Mode hors-ligne actif (pas de clé Groq configurée)', 'info', 4000);
    }, 2000);
  }
}

// Lance l'app
document.addEventListener('DOMContentLoaded', init);
