/**
 * NovaScan — Module API Groq (Mode En ligne)
 * Utilise le LLM Groq pour une analyse NOVA contextuelle avancée
 */

'use strict';

const GroqAPI = (() => {

  // Le prompt système strict basé sur la classification NOVA
  const SYSTEM_PROMPT = `Tu es un expert en nutrition et en classification NOVA des aliments (système de Carlos Monteiro, USP Brésil).

Tu analyses une liste d'ingrédients alimentaires et tu retournes UNIQUEMENT un JSON valide, sans markdown, sans explication.

CLASSIFICATION NOVA :
- NOVA 1 : Aliments non ou minimalement transformés (fruits, légumes, viandes fraîches, œufs, lait, etc.)
- NOVA 2 : Ingrédients culinaires (huiles, beurre, sucre, sel, farine, etc.)
- NOVA 3 : Aliments transformés (conserves, fromages, charcuteries simples, pain artisanal)
- NOVA 4 : Aliments ultra-transformés (présence d'additifs, arômes artificiels, émulsifiants, sucres industriels, etc.)

MARQUEURS D'ULTRA-TRANSFORMATION (NOVA 4) :
- Additifs (codes E) : colorants, conservateurs, émulsifiants, exhausteurs de goût, édulcorants
- Sucres industriels : sirop de glucose-fructose, maltodextrine, dextrose
- Amidons modifiés
- Arômes artificiels ou naturels de synthèse
- Graisses hydrogénées ou interestérifiées
- Protéines isolées ou hydrolysées
- Extraits de levure, glutamate
- Gommes industrielles en excès

SYSTÈME DE SCORE :
- 100% = aliment totalement brut (NOVA 1)
- Chaque marqueur réduit le score selon sa sévérité
- Score final converti en note /10

FORMAT DE RÉPONSE (JSON strict, aucun texte avant ou après) :
{
  "score": <float entre 0 et 10, arrondi au 0.5>,
  "percent": <integer entre 0 et 100>,
  "novaClass": <1, 2, 3 ou 4>,
  "verdictShort": <string court ex: "Bon choix">,
  "verdictLong": <string descriptif 1-2 phrases>,
  "markers": [
    {
      "name": <string nom du marqueur>,
      "desc": <string explication courte>,
      "penalty": <integer points déduits>,
      "severity": <"low", "med" ou "high">,
      "found": <string texte trouvé dans les ingrédients>
    }
  ],
  "positives": [<string ingrédients positifs identifiés>],
  "reasoning": <string justification courte de la classification>
}`;

  /**
   * Analyse les ingrédients via l'API Groq
   * @param {string} ingredientsText - Liste des ingrédients
   * @param {string} apiKey - Clé API Groq
   * @returns {Promise<Object>} Résultat de l'analyse
   */
  async function analyze(ingredientsText, apiKey) {
    if (!apiKey) {
      throw new Error('Clé API Groq manquante. Configurez GROQ_API_KEY.');
    }

    if (!ingredientsText || ingredientsText.trim().length < 5) {
      throw new Error('Liste d\'ingrédients trop courte pour analyse');
    }

    const userMessage = `Analyse ces ingrédients selon la classification NOVA :

"${ingredientsText.trim()}"

Retourne uniquement le JSON demandé.`;

    const requestBody = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,  // Très faible pour résultats cohérents
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    };

    let response;
    try {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (networkError) {
      throw new Error(`Erreur réseau : ${networkError.message}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('Clé API Groq invalide ou expirée');
      }
      if (response.status === 429) {
        throw new Error('Limite de requêtes Groq atteinte — réessayez dans quelques secondes');
      }
      throw new Error(`Erreur API Groq (${response.status}): ${errorData.error?.message || 'Erreur inconnue'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Réponse vide de l\'API Groq');
    }

    let parsed;
    try {
      // Nettoie les éventuelles balises markdown
      const clean = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new Error('Réponse JSON invalide de Groq');
    }

    // Validation et normalisation de la réponse
    return normalizeResponse(parsed);
  }

  /**
   * Normalise et valide la réponse de Groq
   */
  function normalizeResponse(data) {
    const score = parseFloat(data.score) || 5;
    const percent = parseInt(data.percent) || Math.round(score * 10);
    const novaClass = [1, 2, 3, 4].includes(data.novaClass) ? data.novaClass : 4;

    return {
      score: Math.min(10, Math.max(0, Math.round(score * 2) / 2)),
      percent: Math.min(100, Math.max(0, percent)),
      novaClass,
      verdictShort: data.verdictShort || 'Analyse complète',
      verdictLong: data.verdictLong || '',
      markers: Array.isArray(data.markers) ? data.markers.map(m => ({
        name: m.name || 'Marqueur',
        desc: m.desc || '',
        penalty: parseInt(m.penalty) || 10,
        severity: ['low', 'med', 'high'].includes(m.severity) ? m.severity : 'med',
        found: m.found || '',
        category: m.category || 'additif',
      })) : [],
      positives: Array.isArray(data.positives) ? data.positives : [],
      reasoning: data.reasoning || '',
      color: NovaLocal.colorFromScore(score),
      source: 'online',
      model: 'llama-3.3-70b-versatile (Groq)',
      analyzedAt: new Date().toISOString(),
    };
  }

  return { analyze };

})();

window.GroqAPI = GroqAPI;
