/**
 * NovaScan — Module Paramètres
 * Gestion de la clé API Groq et des préférences utilisateur
 * À injecter dans app.js ou charger séparément
 */

'use strict';

const NovaSettings = (() => {

  /** Ouvre la modale de configuration */
  function openSettingsModal() {
    // Supprime une modale existante
    document.getElementById('settings-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:2000;
      background:rgba(26,58,42,.85);
      display:flex;align-items:flex-end;justify-content:center;
      backdrop-filter:blur(4px);
      animation:fadeIn .2s ease;
    `;

    const currentKey = State.groqApiKey || '';
    const maskedKey = currentKey
      ? `${currentKey.substring(0, 8)}${'•'.repeat(Math.min(20, currentKey.length - 8))}...`
      : '';

    modal.innerHTML = `
      <div style="
        background:var(--warm-white);
        border-radius:24px 24px 0 0;
        padding:24px;width:100%;max-width:480px;
        max-height:80dvh;overflow-y:auto;
        animation:slideUp .3s cubic-bezier(.4,0,.2,1);
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h3 style="font-family:Syne,sans-serif;font-weight:700;font-size:1.1rem;color:var(--green-deep)">⚙️ Paramètres</h3>
          <button id="close-settings" style="
            width:32px;height:32px;border-radius:50%;
            background:var(--cream-dark);border:none;cursor:pointer;
            font-size:1rem;display:flex;align-items:center;justify-content:center;
          ">✕</button>
        </div>

        <!-- Clé API Groq -->
        <div style="background:var(--cream);border-radius:14px;padding:16px;margin-bottom:16px">
          <div style="font-size:.78rem;font-weight:700;color:var(--green-deep);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">
            🤖 Clé API Groq (mode en ligne)
          </div>
          <div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:12px;line-height:1.5">
            Obtenez votre clé gratuite sur
            <a href="https://console.groq.com" target="_blank" style="color:var(--green-light)">console.groq.com</a>.
            Stockée localement, jamais partagée.
          </div>
          ${currentKey ? `<div style="font-size:.8rem;font-family:monospace;color:var(--text-muted);background:white;padding:8px 12px;border-radius:8px;margin-bottom:8px">${maskedKey}</div>` : ''}
          <input
            id="settings-api-key"
            type="password"
            placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
            style="
              width:100%;padding:12px;border:2px solid var(--cream-dark);
              border-radius:10px;font-size:.9rem;font-family:monospace;
              background:white;color:var(--text-primary);
              transition:border-color .15s;
            "
            autocomplete="off"
          />
          <div style="display:flex;gap:8px;margin-top:10px">
            <button id="btn-save-key" style="
              flex:1;background:var(--green-deep);color:var(--lime);
              border:none;border-radius:10px;padding:12px;
              font-family:Syne,sans-serif;font-weight:700;font-size:.9rem;
              cursor:pointer;transition:all .15s;
            ">Enregistrer</button>
            ${currentKey ? `<button id="btn-delete-key" style="
              background:rgba(231,76,60,.1);color:#e74c3c;
              border:1px solid rgba(231,76,60,.3);border-radius:10px;padding:12px 16px;
              font-weight:600;font-size:.88rem;cursor:pointer;
            ">Supprimer</button>` : ''}
          </div>
        </div>

        <!-- Infos app -->
        <div style="background:var(--cream);border-radius:14px;padding:16px;margin-bottom:16px">
          <div style="font-size:.78rem;font-weight:700;color:var(--green-deep);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">
            📊 Statistiques
          </div>
          <div id="settings-stats" style="font-size:.85rem;color:var(--text-secondary)">
            Chargement…
          </div>
        </div>

        <!-- Export -->
        <div style="background:var(--cream);border-radius:14px;padding:16px;margin-bottom:8px">
          <div style="font-size:.78rem;font-weight:700;color:var(--green-deep);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">
            📤 Export des données
          </div>
          <button id="btn-export" style="
            width:100%;background:white;color:var(--green-deep);
            border:2px solid var(--cream-dark);border-radius:10px;
            padding:11px;font-weight:600;font-size:.88rem;cursor:pointer;
          ">Exporter l'historique (JSON)</button>
        </div>

        <div style="text-align:center;font-size:.72rem;color:var(--text-muted);margin-top:12px">
          NovaScan v1.0 · Algorithme NOVA (Monteiro, USP)
        </div>
      </div>
    `;

    // Animations CSS inline
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    `;
    modal.appendChild(style);
    document.body.appendChild(modal);

    // Stats
    NovaDB.getStats().then(stats => {
      const el = document.getElementById('settings-stats');
      if (!el) return;
      if (!stats) {
        el.textContent = 'Aucun produit scanné.';
        return;
      }
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><strong>${stats.total}</strong> produits</div>
          <div><strong>${stats.avgScore}/10</strong> score moyen</div>
          <div style="color:#2ecc71"><strong>${stats.byNova[1] + stats.byNova[2]}</strong> NOVA 1-2</div>
          <div style="color:#e74c3c"><strong>${stats.byNova[4]}</strong> NOVA 4</div>
        </div>
      `;
    });

    // Events
    document.getElementById('close-settings')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('btn-save-key')?.addEventListener('click', async () => {
      const key = document.getElementById('settings-api-key')?.value.trim();
      if (!key) { showToast('Clé vide — saisir une clé valide', 'error'); return; }
      if (!key.startsWith('gsk_')) {
        showToast('Format invalide (doit commencer par gsk_)', 'error'); return;
      }
      State.groqApiKey = key;
      localStorage.setItem('nova_groq_key', key);
      await NovaDB.setSetting('groqApiKey', key);
      showToast('Clé API Groq enregistrée ✓', 'success');
      modal.remove();
      updateConnectionBadge();
    });

    document.getElementById('btn-delete-key')?.addEventListener('click', async () => {
      State.groqApiKey = null;
      localStorage.removeItem('nova_groq_key');
      await NovaDB.setSetting('groqApiKey', null);
      showToast('Clé API supprimée — mode local actif', 'info');
      modal.remove();
    });

    document.getElementById('btn-export')?.addEventListener('click', exportHistory);
  }

  /** Exporte l'historique en JSON */
  async function exportHistory() {
    try {
      const products = await NovaDB.getAllProducts();
      if (!products.length) {
        showToast('Aucun produit à exporter', 'info');
        return;
      }
      const json = JSON.stringify({ exported: new Date().toISOString(), products }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novascan-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${products.length} produits exportés`, 'success');
    } catch (err) {
      showToast('Erreur export : ' + err.message, 'error');
    }
  }

  return { openSettingsModal, exportHistory };
})();

window.NovaSettings = NovaSettings;
