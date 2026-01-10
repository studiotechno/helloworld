# Brainstorming Session — MVP Chatbot Codebase

**Date :** 2026-01-09
**Techniques utilisées :** First Principles, Role Playing, SCAMPER
**Objectif :** Définir le MVP d'un produit permettant aux non-tech de parler à leur codebase

---

## Executive Summary

### Vision Produit

> Un chatbot qui permet aux PM et entrepreneurs non-tech de parler en langage naturel à leur codebase GitHub pour comprendre leur produit, anticiper les impacts, et générer des tickets dev-ready.

### Tagline

> "Parlez à votre codebase sans écrire une ligne de code"

### Problème Résolu

Le code est une **boîte noire** pour les personnes qui doivent prendre des décisions produit sans background technique. Cela crée :
- Une friction relationnelle PM/Dev (questions répétitives qui "dérangent")
- Des décisions stratégiques sous-optimales (sans comprendre les impacts)
- Une insécurité décisionnelle (manque de légitimité technique)

### Proposition de Valeur Dual-Sided

| Persona | Valeur |
|---------|--------|
| **PM / Entrepreneur** | Autonomie, compréhension technique, confiance dans les décisions |
| **Développeurs** | Gain de temps (moins de questions, meilleurs tickets, plus de temps pour coder) |

---

## Personas MVP

### Persona 1 — Sarah, PM Junior

**Contexte :** Vient d'arriver sur un projet avec du code legacy. Doit préparer le sprint planning.

**Besoins identifiés :**
- Quelles sont les features principales de mon produit ?
- Quelle est la stack technique ?
- Quel est le schéma de base de données ?
- Qu'est-ce qui a été développé récemment ?
- Si j'implémente X, qu'est-ce que ça impacte ?

**Insight :** Sarah cherche à **construire sa carte mentale** du produit rapidement. L'outil devient un **assistant d'onboarding**.

### Persona 2 — Marc, Entrepreneur Solo (non-tech)

**Contexte :** A fait développer son app par des freelances. Doit lever des fonds et répondre aux questions techniques des investisseurs.

**Besoins identifiés :**
- Analyse automatisée de la dette technique
- Évaluation de la scalabilité
- Recommandations d'amélioration
- Paraître crédible techniquement face aux investisseurs

**Insight :** Marc a besoin d'un outil de **due diligence technique** pour se sentir légitime.

### Persona Écarté

**Head of Product (Julie)** — Pas un persona distinct. Mêmes besoins que PM, juste à plus grande échelle. Ne justifie pas de features spécifiques.

---

## Besoins Fondamentaux (par priorité)

1. **Autonomie** — Ne plus dépendre des devs pour des infos basiques
2. **Confiance** — Se sentir légitime et sûr dans ses décisions
3. **Rapidité** — Obtenir des réponses instantanément
4. **Vérification** — Pouvoir challenger ou valider ce que les devs disent

---

## Use Cases MVP

### 1. Changelog Intelligent
> "Quelles évolutions ont été faites la semaine dernière ?"

### 2. Impact Analysis
> "Si je veux mettre en place une messagerie, qu'est-ce que ça impacte ?"
→ Réponse attendue : écrans, tables BDD, composants concernés

### 3. Estimation Assistée
> "Combien de temps ça prendrait à mes devs ?"

### 4. Aide à la Rédaction de Tickets
> "Quelles infos donner aux devs pour ce ticket ?"
→ Génération de specs dev-ready

### 5. Onboarding Codebase
> "C'est quoi les features principales ? La stack ? Le schéma BDD ?"

### 6. Analyse Dette Technique
> "Où est la dette technique ? Comment l'améliorer ?"
→ Différenciateur clé — personne n'offre cette visibilité facilement

---

## Pourquoi un Chatbot (et pas autre chose)

Le format chatbot n'est pas un choix UX, c'est **la proposition de valeur** :

| Alternative écartée | Raison |
|---------------------|--------|
| Dashboard visuel | L'utilisateur décide ses questions, pas nous |
| Rapports automatiques | Existe déjà via ticketing |
| Extension Linear/Jira | Exclut Notion, solos, non-tech |

**Avantages du chatbot :**
- **User-driven** — L'utilisateur pose les questions qu'il veut
- **Langage naturel** — Pas besoin de connaître "commit", "schema", "endpoint"
- **Traduction intelligente** — Comprend l'intention même avec des termes approximatifs
- **Universel** — Fonctionne pour tous les profils

---

## Positionnement Marché

| Outil existant | Cible | Relation |
|----------------|-------|----------|
| GitHub Copilot | Devs (coder) | Pas concurrent — on ne touche pas au code |
| Swimm / Mintlify | Devs (documenter) | Pas concurrent — on ne génère pas de doc |
| LinearB / Jellyfish | Managers (analytics) | Pas concurrent — on n'est pas analytics |
| **Ce produit** | **Non-tech (comprendre)** | **Blue ocean** |

**Positionnement :** Complémentaire aux outils existants, pas concurrent.

---

## Scope MVP — Décisions

### Inclus dans le MVP

| Feature | Raison |
|---------|--------|
| Connexion GitHub SSO | Core — accès aux repos |
| 1 repo par compte | Simplicité — multi-repo viendra avec la demande |
| Chatbot langage naturel | Coeur de la proposition de valeur |
| Analyse dette technique | Différenciateur — "wow moment" |
| Génération de tickets | Valeur dual-sided PM + Dev |
| Export/téléchargement rapports | Alternative au stockage d'historique |

### Exclu du MVP (post-MVP)

| Feature | Raison |
|---------|--------|
| Multi-repo | Attendre demande client réelle |
| Historique conversations stocké | Export suffit, évite complexité BDD |
| Intégration native Linear/Notion | Copier-coller suffit pour v1 |
| Visualisation diagrammes | Explication textuelle suffit |
| Mode vulgarisation dédié | Comportement natif des LLMs |

### Décision Clé : Export > Stockage

Au lieu de stocker l'historique des conversations :
- L'utilisateur télécharge ses rapports
- Moins de complexité technique
- Moins de responsabilité données
- Questions souvent indépendantes

---

## Intégrations MVP

| Service | Type | MVP |
|---------|------|-----|
| GitHub | OAuth SSO + API repos | ✅ Oui |
| Linear | Import/export tickets | ❌ Copier-coller |
| Notion | Import/export tickets | ❌ Copier-coller |

---

## Insights Clés de la Session

1. **Le chatbot EST la proposition de valeur** — Pas un choix UI, mais le coeur du produit (démocratisation par le langage naturel)

2. **Traducteur bidirectionnel** — Langage naturel → Compréhension technique → Specs dev-ready

3. **Valeur dual-sided** — PM gagne en autonomie, Dev gagne du temps

4. **Blue ocean** — Pas de concurrent direct sur "non-tech parlant à leur codebase"

5. **Export plutôt que stockage** — Choix malin pour réduire la complexité MVP

6. **Dette technique = différenciateur** — Sujet que personne ne veut adresser, forte valeur perçue

---

## Questions Ouvertes (pour sessions futures)

1. **Pricing** — Freemium ? Par repo ? Par utilisateur ? Par requête ?
2. **Limites techniques** — Taille max de repo supportée ? Performance sur gros codebases ?
3. **Sécurité** — Comment rassurer sur la confidentialité du code ?
4. **Précision LLM** — Comment gérer les hallucinations sur du code ?
5. **Onboarding** — Temps de "scan" initial du repo acceptable ?

---

## Prochaines Étapes Recommandées

1. **Validation technique** — Confirmer faisabilité LLM + GitHub API sur un POC
2. **Interviews utilisateurs** — Valider les use cases avec 5-10 PM/entrepreneurs
3. **PRD détaillé** — Transformer ce document en specs avec un agent PM
4. **Maquettes UX** — Définir le flow chatbot et l'expérience utilisateur
5. **Naming & Branding** — Trouver un nom produit

---

## Annexe — Récapitulatif Techniques Utilisées

| Phase | Technique | Output |
|-------|-----------|--------|
| Warm-up | First Principles | Problème racine, besoins fondamentaux, moment wow |
| Divergent | Role Playing (3 personas) | Use cases par profil, persona écarté |
| Divergent | SCAMPER (S, C, A, E) | Validation chatbot, scope MVP, positionnement |
| Convergent | — (skipped) | — |
| Synthèse | Cristallisation | Vision produit, décisions scope |

---

*Document généré lors d'une session de brainstorming BMAD*
