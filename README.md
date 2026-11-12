# Data & AI Governance Architect Lab — huit scénarios simulés

> Simulation basée sur une configuration fictive. Ne constitue pas un audit de sécurité réel.
> Projet indépendant, non affilié à Microsoft. Aucune connexion à un tenant, à Purview ou à un service cloud.

Ce dépôt contient la tranche verticale du laboratoire pour **les huit scénarios du cahier des charges** :
carte du scénario → architecture interactive → modification d'un paramètre → recalcul déterministe
→ animation du parcours → récit et explication sourcée → défis.

| Scénario | Technologies | Configurations guidées | Défis |
| --- | --- | --- | --- |
| Agent RH SharePoint | Copilot Studio, SharePoint, Entra ID, Purview, Power Platform | 6 | 3 |
| Agent financier D365FO | D365 F&O, Link to Fabric, OneLake security, Copilot Studio | 5 | 2 |
| Agent commercial Dataverse | Copilot Studio, Dataverse, politiques de données | 6 | 2 |
| Agent documentaire | Microsoft 365 Copilot, Restricted Content Discovery, Purview DLP | 6 | 2 |
| Agent de validation de factures | Flux d'agent, Human in the loop, rapprochement ERP | 6 | 2 |
| Agent Foundry avec outils MCP | Foundry Agent Service, MCP, guardrails | 7 | 3 |
| Agent connecté à Fabric | Fabric, OneLake security (RLS, CLS), Entra ID | 6 | 3 |
| Agent avec modèle externe | Microsoft Foundry (GPT, Claude), Purview Endpoint DLP | 6 | 2 |

## Parcours utilisateur

Chaque scénario suit quatre étapes, affichées en haut de l'écran :

1. **La demande** : qui demande quoi, avec un seul bouton « Lancer la demande ».
2. **Le trajet** : la requête traverse les briques ; le robot raconte chaque étape.
3. **Le verdict** : « Ça passe », « Bloqué », « Fuite ! » ou « Indéterminé », avec qui a décidé, pourquoi et la source.
4. **Et si… ?** : des questions en langage courant ; chacune relance la demande et le verdict compare avant / après.

Les paramètres techniques, l'affichage des flux et les règles sont dans le tiroir « Réglages avancés ».

## Démarrage

Prérequis : Node.js ≥ 22.18 (exécution native de TypeScript par suppression des types) et `typescript` pour le typecheck.

```bash
npm install --save-dev typescript   # seule dépendance, pour le typecheck
npm run typecheck                   # tsc --strict, sans émission
npm test                            # 30 tests (node:test)
node scripts/build-prototype.mjs    # génère dist/index.html (autonome, sans serveur)
```

Ouvrir `dist/index.html` dans un navigateur. Aucune clé API, aucun abonnement, aucune base de données.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `lib/types` | Contrats du domaine : scénario, nœuds, flux, paramètres, règles, résultats |
| `lib/policy-engine` | Moteur déterministe : conditions, agrégation par étape, résultat, diff |
| `data/sources.ts` | Références Microsoft Learn (URL, date de vérification, statut) |
| `data/scenarios/<id>` | Données de chaque scénario (`scenario.ts`) et dérivation des faits, récit et vue tabulaire (`facts.ts`) |
| `data/scenarios/registry.ts` | Registre des scénarios simulés |
| `tests` | Tests unitaires, test exhaustif, test de parité prototype ↔ moteur |
| `prototype` | Gabarit HTML et interface (rendu uniquement, aucune décision) |
| `scripts/build-prototype.mjs` | Compile le noyau et l'injecte dans le prototype |

## Fonctionnement du moteur

1. `resolveParams` complète les paramètres et rejette toute valeur ou clé inconnue.
2. `deriveHrFacts` calcule des faits à partir des paramètres et des données synthétiques :
   identité effective (utilisateur ou compte du maker), Read à la source, surpartage,
   chiffrement et droits VIEW + EXTRACT, périmètre DLP.
3. Pour chaque étape, les règles dont la condition déclarative (`all`, `any`, `not`, `eq`, `in`)
   est vraie sont retenues ; la décision la plus restrictive l'emporte
   (`deny` > `indeterminate` > `conditional` > `allow` > `observed` > `not-applicable`).
   Les règles `fallback` ne jouent que si aucune règle spécifique ne correspond.
4. Un refus `preRuntime` signifie « agent non publiable » : toutes les étapes suivantes sont non applicables.
   Un refus `stopsRuntime` interrompt le parcours ; seules les étapes d'observation (audit) restent évaluées.
5. `summarizeHr` produit le résultat, l'objectif métier atteint ou non, les événements d'audit et les risques résiduels.
6. `diffResults` explique ce qui change entre deux configurations What-if.

Garde-fous testés : une règle de confiance faible ne peut jamais refuser ; chaque règle cite une page
Microsoft Learn datée ; un fait ou un gabarit inconnu fait échouer l'évaluation au lieu de passer en silence.

## Tests

- 89 tests : règles, transitions, préréglages (résultat attendu figé pour chacun), défis et invariants.
- Tests exhaustifs sur toutes les combinaisons de paramètres de chaque scénario, avec un invariant de sécurité par scénario :
  RH (fuite seulement par surpartage ou identité du maker), Fabric (fuite seulement par rôle Contributor ou DefaultReader),
  MCP (ressource interdite servie seulement avec une clé partagée ; injection réussie seulement si l'outil d'envoi est exposé).
- Chaque défi est prouvé réalisable, et aucun n'est gagné avec la configuration par défaut.
- Un test de parité : le prototype embarque exactement le moteur testé, pour les 48 configurations guidées.
- `data/scenarios/_kit.ts` : aides communes (règles, nœuds, synthèse) pour écrire un scénario de façon compacte.
- Vérifié par mutation : désactiver la règle SP-01 fait échouer 4 tests.

## Limites connues

- **Pas de Next.js, React Flow ni Vitest ici** : l'environnement de génération n'avait pas d'accès réseau.
  Le noyau n'a aucune dépendance et se branche tel quel dans `/lib` d'un projet Next.js.
  La migration des tests vers Vitest se limite à remplacer `node:test` / `assert` par `describe` / `it` / `expect`.
- La mise en page du graphe est une grille par couche, pas Dagre ou ELK.
- Test end-to-end de fumée en Python Playwright (`tests/e2e_smoke.py`, Chromium 1440×900 et 390×844) :
  `python3 tests/e2e_smoke.py` depuis la racine après le build. Version TypeScript Playwright prévue en phase 2.
- Statut GA / Preview : les pages consultées ne le précisent pas ; affiché « statut non précisé ».
- Licences Copilot Studio : à confirmer. Licences Purview : renvoi à la description de service.
- Deux comportements non documentés sont modélisés en « Indéterminé » (PP-02, MIP-02), jamais en refus.
- Modélisés « Indéterminé » : moteur tiers pour une identité non filtrée (Fabric), garde-fou Tool response sur un outil MCP, sécurité de colonne via la connaissance Dataverse, fichiers récemment consultés sur un site RCD (comportement en cours de changement).
- Confiance moyenne : non-propagation des rôles F&O vers Fabric (la documentation décrit l'accès par l'espace Fabric, sans propagation), comportement des déploiements Global.
- Hors périmètre : accès conditionnel, Entra Agent ID, Agent 365, Defender, mode délégué du point de terminaison SQL Fabric.

## Étape suivante

Phase 2 : socle Next.js (App Router, Tailwind, shadcn/ui, React Flow + Dagre) qui consomme ce noyau,
puis Vitest et Playwright TypeScript, puis le comparateur d'architectures et le catalogue des produits.
