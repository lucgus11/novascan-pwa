# 🌿 NovaScan — Analyseur de Qualité Alimentaire NOVA

PWA de scan alimentaire basée sur la **classification NOVA** de Carlos A. Monteiro (USP Brésil). Évalue le degré de transformation des aliments et attribue une note sur 10.

---

## ✨ Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| 📷 **Scan OCR** | Caméra + Tesseract.js pour extraire le texte des étiquettes |
| 🤖 **Analyse IA** | Mode en ligne via API Groq (LLaMA 3.3 70B) |
| ⚡ **Algorithme local** | Mode hors-ligne avec base NOVA embarquée |
| 💾 **Historique** | Sauvegarde IndexedDB persistante |
| 📊 **Score /10** | Note + pourcentage + classe NOVA 1→4 |
| 🔄 **Recalcul** | Modifiez les ingrédients → recalcul automatique |
| 📱 **PWA** | Installable, offline-first, notifications |

---

## 🏗️ Architecture

```
nova-scan/
├── public/
│   ├── index.html          # App shell (SPA)
│   ├── sw.js               # Service Worker (offline)
│   ├── manifest.json       # PWA manifest
│   ├── css/
│   │   └── app.css         # Design system complet
│   ├── js/
│   │   ├── app.js          # Orchestrateur principal
│   │   ├── nova-local.js   # Algorithme NOVA offline
│   │   ├── groq-api.js     # Client API Groq (online)
│   │   ├── camera.js       # Caméra + OCR Tesseract
│   │   └── db.js           # IndexedDB (historique)
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── vercel.json             # Config déploiement Vercel
├── .env.example            # Variables d'environnement
└── README.md
```

---

## 🚀 Déploiement sur Vercel

### 1. Fork / clone le projet
```bash
git clone https://github.com/votre-username/nova-scan.git
cd nova-scan
```

### 2. Push sur GitHub
```bash
git add .
git commit -m "Initial NovaScan PWA"
git push origin main
```

### 3. Déployer sur Vercel
1. Allez sur [vercel.com](https://vercel.com)
2. **New Project** → Importez votre repo GitHub
3. Framework Preset : **Other**
4. Output Directory : `public`
5. **Deploy** !

### 4. Configurer la clé Groq (optionnel)
Dans Vercel → Settings → Environment Variables :
```
GROQ_API_KEY = gsk_xxxxxxxxxxxxxxxxxxxx
```

> **Note :** Sans clé Groq, l'app fonctionne entièrement en mode local offline.

---

## 🔑 Configuration de la clé Groq

1. Créez un compte sur [console.groq.com](https://console.groq.com)
2. Créez une clé API (gratuite, quota généreux)
3. Dans NovaScan, allez dans **Paramètres** (onglet ⚙️)
4. Entrez votre clé → elle est stockée localement dans IndexedDB

---

## 🧠 Algorithme NOVA

### Mode En ligne (Groq)
- Prompt système strict basé sur les critères NOVA
- Modèle : `llama-3.3-70b-versatile`
- Analyse contextuelle des ingrédients
- Retourne JSON structuré (score, classe, marqueurs)

### Mode Hors-ligne (Local)
```
Score = 100 - Σ(pénalités) + Σ(bonus)
Note /10 = Score / 10 (arrondi au 0.5)
```

**Pénalités par marqueur (exemples) :**
| Marqueur | Pénalité |
|---|---|
| Graisses partiellement hydrogénées | −20 pts |
| Sirop de glucose-fructose | −18 pts |
| Nitrites (E249-E252) | −18 pts |
| Colorants artificiels | −18 pts |
| Émulsifiants (E471, E472) | −16 pts |
| Arômes artificiels | −16 pts |
| Glutamate (MSG) | −16 pts |
| Édulcorants intenses | −14 pts |
| Amidon modifié | −14 pts |
| Carraghénane | −14 pts |

**Bonus :**
| Ingrédient | Bonus |
|---|---|
| Huile d'olive vierge extra | +3 pts |
| Fruits entiers | +3 pts |
| Herbes aromatiques | +2 pts |
| Épices | +2 pts |

### Correspondance NOVA → Score
| Classe NOVA | Score | Description |
|---|---|---|
| NOVA 1 | ≥ 8.5/10 | Non/minimalement transformé |
| NOVA 2 | 6.5–8.4/10 | Ingrédients culinaires |
| NOVA 3 | 4.0–6.4/10 | Transformé |
| NOVA 4 | < 4.0/10 | Ultra-transformé |

---

## 📱 Installation PWA

### Sur mobile (Chrome/Safari)
1. Ouvrez l'URL dans le navigateur
2. **Chrome Android** : Menu → "Ajouter à l'écran d'accueil"
3. **Safari iOS** : Partager → "Sur l'écran d'accueil"

### Sur desktop (Chrome/Edge)
- Icône d'installation dans la barre d'adresse
- ou Menu → "Installer NovaScan"

---

## 🛠️ Développement local

```bash
# Serveur statique simple (Python)
cd nova-scan/public
python3 -m http.server 8080

# Ou avec Node.js
npx serve public -p 8080
```

Ouvrez `http://localhost:8080`

> ⚠️ La caméra nécessite HTTPS ou localhost.

---

## 🔒 Confidentialité

- **Aucun serveur intermédiaire** : les ingrédients sont envoyés directement à l'API Groq
- **Données locales** : l'historique reste dans IndexedDB sur votre appareil
- **Clé API** : stockée localement, jamais transmise ailleurs qu'à Groq
- **Mode hors-ligne** : 100% local, aucune donnée transmise

---

## 📚 Références

- [Classification NOVA — Monteiro et al. (2010)](https://doi.org/10.1590/S0034-89102010000200001)
- [NOVA Food Groups — PAHO/WHO](https://iris.paho.org/handle/10665.2/7698)
- [API Groq](https://console.groq.com/docs)
- [Tesseract.js](https://tesseract.projectnaptha.com/)

---

*NovaScan v1.0 — MIT License*
