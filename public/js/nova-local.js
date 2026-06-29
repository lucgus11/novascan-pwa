/**
 * NovaScan — Algorithme Local NOVA (Offline)
 * Basé sur la classification NOVA de Carlos A. Monteiro (USP)
 *
 * Système de score :
 *  - Base : 100 points (produit "pur")
 *  - Chaque marqueur déduit des points selon sa sévérité
 *  - Score final /100 converti en note /10
 */

'use strict';

const NovaLocal = (() => {

  // ── Base de données des marqueurs NOVA ──────────────────────────────────

  const MARKERS = {

    // ═══ ADDITIFS E-CODES (codes officiels UE) ═══════════════════════════
    additifs: [
      // Colorants artificiels (NOVA 4 — fort impact)
      { code: /\bE1[0-2]\d\b/gi, name: 'Colorant artificiel', penalty: 18, severity: 'high',
        desc: 'Colorants de synthèse souvent inutiles nutritionnellement', category: 'colorant' },
      { code: /\bE1[3-4]\d\b/gi, name: 'Colorant artificiel (caramel)', penalty: 12, severity: 'med',
        desc: 'Colorants caramel (certains classés cancérogènes probables)', category: 'colorant' },
      { code: /\bE15[0-9]\b/gi, name: 'Colorant artificiel', penalty: 14, severity: 'high',
        desc: 'Colorants artificiels à surveiller', category: 'colorant' },

      // Conservateurs (NOVA 4)
      { code: /\bE2[0-9]\d\b/gi, name: 'Conservateur synthétique', penalty: 15, severity: 'high',
        desc: 'Conservateurs chimiques étendant la durée de vie', category: 'conservateur' },
      { code: /\bE200\b|\bE202\b|\bE203\b/gi, name: 'Sorbate', penalty: 8, severity: 'med',
        desc: 'Conservateur (sorbate) — impact modéré', category: 'conservateur' },
      { code: /\bE210\b|\bE211\b|\bE212\b|\bE213\b/gi, name: 'Benzoate', penalty: 14, severity: 'high',
        desc: 'Benzoates — associés à hyperactivité chez l\'enfant', category: 'conservateur' },
      { code: /\bE220\b|\bE221\b|\bE222\b|\bE223\b|\bE224\b/gi, name: 'Sulfite/Dioxyde de soufre', penalty: 10, severity: 'med',
        desc: 'Sulfites — allergènes potentiels', category: 'conservateur' },
      { code: /\bE249\b|\bE250\b|\bE251\b|\bE252\b/gi, name: 'Nitrate/Nitrite', penalty: 18, severity: 'high',
        desc: 'Nitrites — marqueur fort de transformation des charcuteries', category: 'conservateur' },

      // Antioxydants synthétiques (NOVA 4)
      { code: /\bE320\b|\bE321\b/gi, name: 'BHA/BHT', penalty: 16, severity: 'high',
        desc: 'Antioxydants synthétiques controversés', category: 'antioxydant' },
      { code: /\bE3[0-3]\d\b/gi, name: 'Antioxydant synthétique', penalty: 10, severity: 'med',
        desc: 'Antioxydants de synthèse', category: 'antioxydant' },

      // Émulsifiants (NOVA 4 — très fréquents dans l'ultra-transformé)
      { code: /\bE4[0-7]\d\b/gi, name: 'Émulsifiant', penalty: 14, severity: 'high',
        desc: 'Émulsifiants modifiant la texture — marqueur ultra-transformation', category: 'emulsifiant' },
      { code: /\bE471\b|\bE472\b/gi, name: 'Mono/Diglycérides', penalty: 16, severity: 'high',
        desc: 'Graisses modifiées — émulsifiants industriels typiques', category: 'emulsifiant' },
      { code: /\bE476\b/gi, name: 'Polyglycérol polyricinoléate', penalty: 12, severity: 'high',
        desc: 'Émulsifiant industriel (chocolats bon marché)', category: 'emulsifiant' },

      // Épaississants / Stabilisants
      { code: /\bE4[8-9]\d\b|\bE5[0-1]\d\b/gi, name: 'Épaississant/Stabilisant', penalty: 8, severity: 'med',
        desc: 'Agents de texture industriels', category: 'texture' },
      { code: /\bE407\b/gi, name: 'Carraghénane', penalty: 14, severity: 'high',
        desc: 'Carraghénane — inflammatoire selon certaines études', category: 'texture' },
      { code: /\bE415\b/gi, name: 'Gomme xanthane', penalty: 8, severity: 'low',
        desc: 'Épaississant — présent dans de nombreux produits transformés', category: 'texture' },

      // Exhausteurs de goût (NOVA 4 — signal fort)
      { code: /\bE621\b|\bE622\b|\bE623\b|\bE624\b|\bE625\b/gi, name: 'Glutamate (MSG)', penalty: 16, severity: 'high',
        desc: 'Exhausteurs de goût — masquent la mauvaise qualité des ingrédients', category: 'exhausteur' },
      { code: /\bE6[0-9]\d\b/gi, name: 'Exhausteur de goût', penalty: 12, severity: 'high',
        desc: 'Exhausteurs de goût synthétiques', category: 'exhausteur' },

      // Édulcorants (NOVA 4)
      { code: /\bE950\b|\bE951\b|\bE952\b|\bE953\b|\bE954\b|\bE955\b|\bE956\b|\bE957\b|\bE959\b|\bE960\b|\bE961\b|\bE962\b|\bE965\b|\bE966\b|\bE967\b|\bE968\b/gi,
        name: 'Édulcorant de synthèse', penalty: 14, severity: 'high',
        desc: 'Édulcorants intenses — marqueur ultra-transformation', category: 'edulcorant' },

      // Agents levants / anti-agglomérants industriels
      { code: /\bE5[4-9]\d\b/gi, name: 'Agent levant/Anti-agglomérant', penalty: 6, severity: 'low',
        desc: 'Additifs technologiques (impact modéré)', category: 'technologique' },

      // Code générique E-xxx (fallback)
      { code: /\bE\d{3}[a-z]?\b/gi, name: 'Additif E-code', penalty: 10, severity: 'med',
        desc: 'Additif alimentaire identifié', category: 'additif' },
    ],

    // ═══ MARQUEURS TEXTUELS (ingrédients ultra-transformés) ═══════════════
    keywords: [
      // Sucres et sirops modifiés (NOVA 4 — signal majeur)
      { pattern: /sirop\s+de\s+glucose(?:\s*[\-–]\s*fructose)?/gi, name: 'Sirop de glucose-fructose', penalty: 18, severity: 'high',
        desc: 'Sucre ultra-raffiné industriel — marqueur clé NOVA 4' },
      { pattern: /sirop\s+de\s+glucose/gi, name: 'Sirop de glucose', penalty: 16, severity: 'high',
        desc: 'Sucre industriel raffiné' },
      { pattern: /sirop\s+de\s+fructose/gi, name: 'Sirop de fructose', penalty: 16, severity: 'high',
        desc: 'Sucre industriel à haute teneur en fructose' },
      { pattern: /sirop\s+de\s+ma[iï]s/gi, name: 'Sirop de maïs', penalty: 16, severity: 'high',
        desc: 'HFCS — sirop de maïs à haute teneur en fructose' },
      { pattern: /maltodextrine/gi, name: 'Maltodextrine', penalty: 14, severity: 'high',
        desc: 'Amidon ultra-transformé — charge glycémique élevée' },
      { pattern: /dextrose/gi, name: 'Dextrose', penalty: 12, severity: 'med',
        desc: 'Sucre industriel raffiné' },
      { pattern: /fructose\s+(?:cristallin|pur)/gi, name: 'Fructose cristallin', penalty: 14, severity: 'high',
        desc: 'Fructose industriel pur' },

      // Amidons modifiés (NOVA 4)
      { pattern: /amidon\s+(?:modifi[ée]|transform[ée])/gi, name: 'Amidon modifié', penalty: 14, severity: 'high',
        desc: 'Amidon chimiquement transformé — marqueur NOVA 4' },
      { pattern: /amidon\s+de\s+(?:blé|maïs|pomme\s+de\s+terre|manioc|riz)\s+modifi[ée]/gi,
        name: 'Amidon modifié', penalty: 14, severity: 'high',
        desc: 'Amidon modifié chimiquement' },
      { pattern: /f[ée]cule\s+modifi[ée]/gi, name: 'Fécule modifiée', penalty: 14, severity: 'high',
        desc: 'Fécule chimiquement modifiée' },

      // Arômes artificiels (NOVA 4)
      { pattern: /ar[ôo]mes?\s+(?:artificiels?|de\s+synth[eè]se)/gi, name: 'Arôme artificiel', penalty: 16, severity: 'high',
        desc: 'Arômes de synthèse — imitation de saveurs naturelles' },
      { pattern: /ar[ôo]mes?\s+(?:naturels?(?:\s+et\s+artificiels?)?)/gi, name: 'Arôme (naturel/artificiel)', penalty: 8, severity: 'med',
        desc: 'Aromatisation industrielle (peut contenir des synthétiques)' },
      { pattern: /\bar[ôo]mes?\b/gi, name: 'Arôme', penalty: 6, severity: 'low',
        desc: 'Présence d\'arômes (origine non précisée)' },
      { pattern: /parfum(?:s)?\s+(?:artificiel|synth[eè]tique)/gi, name: 'Parfum artificiel', penalty: 14, severity: 'high',
        desc: 'Aromatisation artificielle' },

      // Graisses industrielles (NOVA 4)
      { pattern: /huile\s+(?:de\s+palme(?:\s+hydrog[eé]n[eée]e?)?|hydrog[eé]n[eée]e?)/gi,
        name: 'Huile de palme/hydrogénée', penalty: 16, severity: 'high',
        desc: 'Graisse industrielle — acides gras trans potentiels' },
      { pattern: /graisse(?:s)?\s+(?:v[eé]g[eé]tale?s?\s+)?hydrog[eé]n[eée]e?s?/gi,
        name: 'Graisses hydrogénées', penalty: 18, severity: 'high',
        desc: 'Graisses trans industrielles — marqueur ultra-transformation majeur' },
      { pattern: /graisse(?:s)?\s+(?:v[eé]g[eé]tale?s?\s+)?partiellement\s+hydrog[eé]n[eée]e?s?/gi,
        name: 'Graisses partiellement hydrogénées', penalty: 20, severity: 'high',
        desc: 'Acides gras trans — marqueur NOVA 4 critique' },
      { pattern: /interestérifi[ée]/gi, name: 'Graisse interestérifiée', penalty: 14, severity: 'high',
        desc: 'Graisse restructurée chimiquement' },

      // Protéines transformées (NOVA 4)
      { pattern: /prot[eé]ines?\s+(?:de\s+(?:soja|bl[eé]|lait|pois)\s+)?(?:hydrolys[eée]e?s?|textur[eée]e?s?|isol[eée]e?s?)/gi,
        name: 'Protéine transformée', penalty: 14, severity: 'high',
        desc: 'Protéines industriellement modifiées — marqueur NOVA 4' },
      { pattern: /casein(?:ate)?/gi, name: 'Caséinate', penalty: 10, severity: 'med',
        desc: 'Protéine laitière industriellement isolée' },
      { pattern: /lactos[eé]rum|whey\s+(?:protein)?/gi, name: 'Lactosérum industriel', penalty: 8, severity: 'med',
        desc: 'Protéine de petit-lait isolée industriellement' },

      // Exhausteurs naturels (signal modéré)
      { pattern: /extrait\s+de\s+levure/gi, name: 'Extrait de levure', penalty: 10, severity: 'med',
        desc: 'Substitut naturel du MSG — souvent signe de transformation' },
      { pattern: /levure\s+(?:autolys[eée]e?|hydrolys[eée]e?)/gi, name: 'Levure autolysée', penalty: 12, severity: 'high',
        desc: 'Exhausteur de goût — marqueur transformation' },

      // Agents de texture industriels
      { pattern: /carraghenane|carrag[eé]nan/gi, name: 'Carraghénane', penalty: 14, severity: 'high',
        desc: 'Épaississant potentiellement inflammatoire' },
      { pattern: /gomme\s+(?:xanthane|guar|arabique|gellane|caroube)/gi, name: 'Gomme industrielle', penalty: 8, severity: 'med',
        desc: 'Agent de texture industriel' },
      { pattern: /amidon\s+natif\b/gi, name: 'Amidon natif', penalty: 4, severity: 'low',
        desc: 'Amidon non modifié (impact faible)' },
      { pattern: /cellulose\s+(?:microcristalline|modifi[eée]e?)/gi, name: 'Cellulose modifiée', penalty: 10, severity: 'med',
        desc: 'Fibre industriellement traitée' },
      { pattern: /lecithine\s+de\s+(?:soja|tournesol)/gi, name: 'Lécithine (émulsifiant)', penalty: 6, severity: 'low',
        desc: 'Émulsifiant courant — impact modéré' },

      // Sel / sodium en excès
      { pattern: /glutamate\s+(?:de\s+)?(?:sodium|monosodique)|msg\b/gi, name: 'Glutamate monosodique', penalty: 16, severity: 'high',
        desc: 'Exhausteur de goût — masque la mauvaise qualité' },
      { pattern: /phosphate\s+de\s+(?:sodium|calcium|potassium)/gi, name: 'Phosphate', penalty: 10, severity: 'med',
        desc: 'Sel minéral industriel (impact modéré)' },

      // Colorants naturels à surveiller
      { pattern: /caramel\s+(?:color|colorant|iv|iii)/gi, name: 'Caramel colorant', penalty: 12, severity: 'med',
        desc: 'Colorant caramel (classes III/IV controversées)' },
      { pattern: /b[eè]ta[- ]carrot[eè]ne\s+de\s+synth[eè]se/gi, name: 'Béta-carotène synthétique', penalty: 10, severity: 'med',
        desc: 'Colorant de synthèse' },

      // Alcool de sucre (édulcorants)
      { pattern: /sorbitol|mannitol|xylitol|maltitol|lactitol|erythritol|isomalt/gi,
        name: 'Alcool de sucre (édulcorant)', penalty: 10, severity: 'med',
        desc: 'Édulcorant — marqueur transformation (régimes, confiseries)' },

      // Sucralose, aspartame, stévia ultra-transformée
      { pattern: /sucralose|aspartame|ac[eé]sulfame|saccharine|cyclamate|n[eé]otame|advantame/gi,
        name: 'Édulcorant intense', penalty: 14, severity: 'high',
        desc: 'Édulcorant de synthèse intense — marqueur NOVA 4' },
      { pattern: /st[eé]via(?:\s+(?:extrait|reb\s*A))?/gi, name: 'Stévia (extrait)', penalty: 6, severity: 'low',
        desc: 'Édulcorant naturel (impact faible mais marque transformation)' },

      // Acides et acidifiants industriels
      { pattern: /acide\s+(?:ascorbique\s+)?(?:de\s+synth[eè]se|artificiel)/gi,
        name: 'Acide artificiel', penalty: 10, severity: 'med',
        desc: 'Acidifiant synthétique' },
      { pattern: /acide\s+citrique\b/gi, name: 'Acide citrique', penalty: 4, severity: 'low',
        desc: 'Acidifiant courant (faible impact)' },

      // Eau — signal neutre mais indicateur de reconstitution
      { pattern: /eau\s+(?:reconstitu[eée]e?|trait[eée]e?|filtr[eée]e?)/gi,
        name: 'Eau reconstituée', penalty: 8, severity: 'med',
        desc: 'Reconstitution industrielle du produit' },

      // Mentions génériques de transformation
      { pattern: /concentr[eé]?\s+de\s+(?:jus\s+de\s+fruits?|légumes?)/gi,
        name: 'Concentré de jus', penalty: 8, severity: 'med',
        desc: 'Jus concentré — perte de valeur nutritive' },
      { pattern: /poudre\s+de\s+(?:lait|lactos[eé]rum|cacao|vanille\s+artificielle)/gi,
        name: 'Poudre industrielle', penalty: 8, severity: 'med',
        desc: 'Ingrédient déshydraté industriellement' },
      { pattern: /isolat\s+de\s+prot[eé]ine/gi, name: 'Isolat de protéine', penalty: 12, severity: 'high',
        desc: 'Protéine ultra-raffinée — NOVA 4' },
    ],

    // ═══ MARQUEURS POSITIFS (bonus) ══════════════════════════════════════
    positive: [
      { pattern: /\b(?:farine\s+de\s+blé\s+(?:compl[eè]te?|int[eé]grale?))/gi, bonus: 4, name: 'Farine complète' },
      { pattern: /\b(?:fruits?\s+(?:frais|entiers?|secs?))\b/gi, bonus: 3, name: 'Fruits entiers/secs' },
      { pattern: /\b(?:graines?\s+de\s+(?:chia|lin|tournesol|courge|s[eé]same))\b/gi, bonus: 3, name: 'Graines entières' },
      { pattern: /\b(?:l[eé]gumes?\s+(?:frais|s[eè]cs?))\b/gi, bonus: 3, name: 'Légumes frais/secs' },
      { pattern: /\b(?:huile\s+d['\s]*olive\s+(?:vierge|extra))/gi, bonus: 3, name: 'Huile d\'olive vierge' },
      { pattern: /\b(?:vinaigre\s+(?:de\s+)?(?:vin|pomme|cidre|balsamique))\b/gi, bonus: 2, name: 'Vinaigre naturel' },
      { pattern: /\b(?:herbes?\s+(?:aromatic?ques?|de\s+provence|fra[iî]ches?))\b/gi, bonus: 2, name: 'Herbes aromatiques' },
      { pattern: /\b(?:épices?)\b/gi, bonus: 2, name: 'Épices' },
      { pattern: /\b(?:miel\s+(?:cru|de\s+fleurs?))\b/gi, bonus: 2, name: 'Miel naturel' },
    ],
  };

  // ── Fonctions utilitaires ─────────────────────────────────────────────

  /** Nettoie et normalise le texte des ingrédients */
  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      // Ne pas supprimer les accents pour les patterns, juste normaliser
      .replace(/\u0300-\u036f/g, '')  // Strip combining marks for matching
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Déduplique les marqueurs détectés */
  function deduplicateMarkers(markers) {
    const seen = new Set();
    return markers.filter(m => {
      const key = m.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Calcule la classe NOVA à partir du score */
  function novaClassFromScore(score) {
    if (score >= 8.5) return 1;
    if (score >= 6.5) return 2;
    if (score >= 4.0) return 3;
    return 4;
  }

  /** Verdict textuel */
  function verdictFromScore(score, novaClass) {
    const verdicts = {
      1: ['Excellent choix', 'Aliment brut ou peu transformé — à favoriser !'],
      2: ['Bon choix', 'Ingrédient culinaire peu transformé'],
      3: ['Acceptable', 'Produit transformé — consommation modérée conseillée'],
      4: score < 3
        ? ['Très mauvais choix', 'Aliment ultra-transformé — à éviter ou limiter fortement']
        : ['Mauvais choix', 'Produit ultra-transformé — à consommer exceptionnellement'],
    };
    return verdicts[novaClass];
  }

  /** Couleur du score */
  function colorFromScore(score) {
    if (score >= 8) return '#2ecc71';
    if (score >= 6) return '#a8c420';
    if (score >= 4) return '#e67e22';
    return '#e74c3c';
  }

  // ── Algorithme principal ──────────────────────────────────────────────

  /**
   * Analyse les ingrédients selon l'algorithme NOVA local
   * @param {string} ingredientsText - Texte brut de la liste d'ingrédients
   * @returns {Object} Résultat complet de l'analyse
   */
  function analyze(ingredientsText) {
    if (!ingredientsText || ingredientsText.trim().length < 3) {
      return {
        score: null,
        percent: null,
        novaClass: null,
        markers: [],
        positives: [],
        error: 'Texte trop court pour l\'analyse',
      };
    }

    const text = ingredientsText; // On garde l'original pour les regex
    const detected = [];
    let totalPenalty = 0;
    let bonusPoints = 0;

    // ── 1. Scan des additifs E-codes ─────────────────────────────────
    for (const additive of MARKERS.additifs) {
      const matches = [...text.matchAll(additive.code)];
      if (matches.length > 0) {
        // Déduplique les codes trouvés
        const uniqueMatches = [...new Set(matches.map(m => m[0].toUpperCase()))];
        for (const match of uniqueMatches) {
          detected.push({
            name: `${additive.name} (${match})`,
            desc: additive.desc,
            penalty: additive.penalty,
            severity: additive.severity,
            category: additive.category || 'additif',
            found: match,
          });
          totalPenalty += additive.penalty;
        }
      }
    }

    // ── 2. Scan des marqueurs textuels ───────────────────────────────
    for (const marker of MARKERS.keywords) {
      // Reset lastIndex pour les regex globales
      marker.pattern.lastIndex = 0;
      const matches = [...text.matchAll(marker.pattern)];
      if (matches.length > 0) {
        detected.push({
          name: marker.name,
          desc: marker.desc,
          penalty: marker.penalty,
          severity: marker.severity,
          category: 'ingredient',
          found: matches[0][0],
        });
        totalPenalty += marker.penalty;
      }
    }

    // ── 3. Bonus pour ingrédients positifs ──────────────────────────
    const positivesFound = [];
    for (const pos of MARKERS.positive) {
      pos.pattern.lastIndex = 0;
      if (pos.pattern.test(text)) {
        positivesFound.push(pos.name);
        bonusPoints += pos.bonus;
      }
    }

    // ── 4. Calcul du score ──────────────────────────────────────────
    // Base : 100 points
    // On plafonne les pénalités à 95 (on garde toujours un minimum)
    const effectivePenalty = Math.min(totalPenalty, 95);
    const rawPercent = Math.max(5, 100 - effectivePenalty + bonusPoints);
    const percent = Math.min(100, rawPercent);

    // Conversion en note sur 10 (arrondie au 0.5 près)
    const rawScore = percent / 10;
    const score = Math.round(rawScore * 2) / 2; // Arrondi au 0.5

    // Déduplication des marqueurs
    const dedupedMarkers = deduplicateMarkers(detected)
      .sort((a, b) => b.penalty - a.penalty); // Tri par sévérité

    const novaClass = novaClassFromScore(score);
    const [verdictShort, verdictLong] = verdictFromScore(score, novaClass);

    return {
      score: score,
      percent: percent,
      novaClass: novaClass,
      markers: dedupedMarkers,
      positives: positivesFound,
      totalPenalty: effectivePenalty,
      bonusPoints: bonusPoints,
      verdictShort: verdictShort,
      verdictLong: verdictLong,
      color: colorFromScore(score),
      source: 'offline',
      analyzedAt: new Date().toISOString(),
    };
  }

  // ── Export ────────────────────────────────────────────────────────────
  return {
    analyze,
    novaClassFromScore,
    verdictFromScore,
    colorFromScore,
  };

})();

// Rend disponible globalement
window.NovaLocal = NovaLocal;
