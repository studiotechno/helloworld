---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - docs/brainstorming-session-results.md
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 1
  projectDocs: 0
workflowType: 'prd'
lastStep: 11
status: complete
completedAt: 2026-01-09
---

# Product Requirements Document - antoineoriol

**Author:** Techno
**Date:** 2026-01-09

## Executive Summary

Un chatbot conversationnel qui permet aux Product Managers de dialoguer en langage naturel avec leur codebase GitHub. L'utilisateur pose ses questions comme il parlerait à un collègue ; le système répond avec précision et vocabulaire professionnel.

**Vision :** Démocratiser l'accès à la compréhension technique sans vulgariser les réponses.

**Problème résolu :** Le code est une boîte noire pour ceux qui prennent des décisions produit. Cela crée une friction PM/Dev, des décisions sous-optimales, et une insécurité décisionnelle.

**Proposition de valeur dual-sided :**
- **PM** : Autonomie, compréhension technique, confiance dans les décisions
- **Développeurs** : Gain de temps (moins de questions, meilleurs tickets)

### Ce qui rend ce produit spécial

**La conversation est la proposition de valeur.** Pas un dashboard, pas des rapports — un dialogue naturel et itératif avec son codebase. Le "moment wow" : poser une question en langage naturel et obtenir une réponse précise, utile, sans déranger personne.

**Positionnement blue ocean** — Aucun concurrent direct sur "non-tech parlant à leur codebase".

## Classification Projet

**Type technique :** SaaS B2B (Web App)
**Domaine :** Général (productivité / developer-adjacent)
**Complexité :** Moyenne
**Contexte projet :** Greenfield - nouveau projet

## Success Criteria

### User Success

**Moment de succès principal :** Le PM répond à une question technique en réunion avec assurance — sans hésiter, sans dire "je demanderai au dev".

**Moments de succès secondaires :**
- Comprendre l'impact d'une feature sans solliciter l'équipe technique
- Générer un ticket et recevoir un retour positif du dev ("enfin un ticket clair")

**Valeur émotionnelle :** Légitimité et confiance priment sur le gain de temps. L'utilisateur se sent compétent et autonome.

### Business Success

**À 3 mois :**
- ~20 PM actifs qui trouvent le produit vraiment utile
- Métrique clé : récurrence d'usage (1+ fois par semaine)
- Signal de succès : le produit devient un réflexe, un outil de travail

**À 12 mois :**
- Approfondir la niche plutôt que scaler
- Intégrations dans l'écosystème PM (Linear, Notion)
- Stratégie : outil indispensable pour peu de gens > outil sympa pour beaucoup

### Technical Success

**Précision & Pédagogie :**
- Réponses précises ET pédagogues — pas juste correctes, mais qui font comprendre
- Gestion transparente des limites (quand le LLM n'est pas sûr, il le dit)

**Rapidité contextuelle :**
- Questions simples : réponse en quelques secondes
- Analyses profondes : temps d'attente acceptable avec feedback visuel (animation)

**Contraintes initiales :**
- Repos de taille moyenne (<10k lignes pour commencer)
- Évolution basée sur les retours utilisateurs

### Measurable Outcomes

| Métrique | Cible 3 mois | Cible 12 mois |
|----------|--------------|---------------|
| PM actifs | ~20 | À définir selon traction |
| Récurrence | 1+/semaine | Plusieurs fois/semaine |
| Satisfaction | "Vraiment utile" | "Indispensable" |

## Product Scope

### MVP - Minimum Viable Product

- Connexion GitHub OAuth (SSO)
- 1 repo par compte
- Chat en langage naturel
- Réponses précises et pédagogues
- Analyse dette technique (différenciateur clé)
- Export des conversations (PDF/Markdown)

### Growth Features (Post-MVP)

- Intégrations Linear/Notion pour génération de tickets
- Support multi-repo
- Historique des conversations persistant
- Meilleure intégration dans le workflow PM quotidien

### Vision (Future)

- Outil central du workflow PM
- Génération de specs dev-ready en un clic
- Suggestions proactives ("tu devrais regarder ce fichier avant ta réunion")
- Le "collègue tech" toujours disponible

## User Journeys

### Journey 1 : Sarah, PM — Préparer son sprint planning en confiance

Sarah vient d'arriver dans une startup comme PM. Le code a 3 ans, personne n'a documenté grand-chose, et le tech lead est débordé. Vendredi, elle doit présenter le sprint planning. Elle a une liste de features demandées par le CEO mais aucune idée de leur complexité technique.

Elle se connecte au chatbot avec le repo GitHub de la boîte. Elle demande : "C'est quoi les features principales de l'app aujourd'hui ?" — en 30 secondes, elle a une vue claire. Elle enchaîne : "Si on veut ajouter un système de notifications push, ça impacte quoi ?" — le chatbot liste les composants concernés, les tables BDD à modifier, et signale un point de vigilance sur le système d'auth.

Vendredi en réunion, quand le CEO demande "c'est faisable en 2 semaines ?", Sarah répond avec assurance : "Il y a un impact sur 3 composants et une dépendance avec l'auth, je recommande plutôt 3 semaines." Le tech lead la regarde, surpris et soulagé.

### Journey 2 : Marc, Entrepreneur — Paraître crédible face aux investisseurs

Marc a lancé sa marketplace il y a 18 mois. Il a fait développer l'app par une agence, puis des freelances. Le code fonctionne, mais il n'a aucune idée de son état réel. Il a décroché un rendez-vous avec un fonds qui veut investir — mais ils vont poser des questions techniques. "C'est scalable ? Y'a de la dette technique ?"

La veille du rendez-vous, Marc connecte son repo au chatbot. Il demande : "Analyse-moi la dette technique de ce projet." Après quelques secondes, il obtient un rapport clair : 3 zones de risque identifiées, des recommandations concrètes, et une estimation de l'effort pour assainir. Il demande ensuite : "Est-ce que l'architecture peut tenir 10x plus d'utilisateurs ?" — le chatbot lui explique les points de contention potentiels, en termes qu'il comprend.

Le lendemain face aux investisseurs, quand ils demandent "vous avez de la dette technique ?", Marc répond : "Oui, on a identifié 3 zones prioritaires, principalement sur la couche data. On a budgété 6 semaines de refacto avant la scale." Les investisseurs hochent la tête — ce type sait de quoi il parle.

### Journey 3 : Julie, Head of Product — Arbitrer la roadmap avec lucidité

Julie est Head of Product chez un éditeur SaaS B2B. Son équipe de 4 devs est sollicitée de partout : le sales veut une intégration Salesforce, le support veut un meilleur système de tickets, le CEO veut une refonte du dashboard. Julie doit arbitrer, mais chaque feature semble "prioritaire" et "pas si compliquée" selon celui qui la demande.

Elle ouvre le chatbot et pose la question frontalement : "Compare-moi l'effort pour ces 3 features : intégration Salesforce, refonte tickets support, refonte dashboard." Le chatbot analyse le code existant et lui donne une estimation comparative avec les composants impactés pour chaque option. L'intégration Salesforce touche 2 modules, la refonte tickets en touche 5 avec une dépendance legacy risquée.

En comité produit, Julie présente son arbitrage : "On fait Salesforce ce trimestre — impact limité, valeur sales immédiate. La refonte tickets attendra qu'on ait nettoyé le module legacy, sinon on crée plus de problèmes qu'on n'en résout." Personne ne conteste — les données parlent.

### Journey Requirements Summary

Ces parcours révèlent les capacités suivantes :

| Capacité | Journeys concernés | Priorité MVP |
|----------|-------------------|--------------|
| Connexion GitHub OAuth | Tous | Oui |
| Vue d'ensemble codebase (features, stack, schéma) | Sarah, Julie | Oui |
| Analyse d'impact d'une feature | Sarah, Julie | Oui |
| Analyse dette technique | Marc | Oui |
| Évaluation scalabilité | Marc | Oui |
| Comparaison effort entre features | Julie | Oui |
| Export rapport | Marc | Oui |
| Réponses pédagogues et précises | Tous | Oui |

## Innovation & Novel Patterns

### Innovation Principale

**Rendre accessible la compréhension d'une codebase.**

L'innovation n'est pas technologique (LLM + analyse de code existe). C'est une innovation d'**usage** : démocratiser l'accès à une compétence réservée aux personnes qui savent lire du code.

### Positionnement Blue Ocean

Aucun concurrent direct ne cible "non-tech parlant à leur codebase" :
- GitHub Copilot → pour les devs (coder)
- Swimm/Mintlify → pour les devs (documenter)
- LinearB/Jellyfish → pour les managers (analytics)
- **Ce produit** → pour les product people (comprendre)

### Validation & Gestion du Risque

**Risque principal :** Un PM donne une mauvaise info en réunion à cause du chatbot → perte de confiance dans le produit.

**Stratégie de mitigation — Confiance binaire :**
- Pas d'affichage de niveau de certitude (créerait du doute permanent)
- Garde-fou dans le prompt : si certitude interne < 80%, l'IA répond "je ne sais pas"
- L'utilisateur reçoit soit une réponse affirmée, soit un aveu d'ignorance
- Principe : mieux vaut un "je ne sais pas" honnête qu'un "peut-être" qui mine la confiance

### Hypothèse à Valider

**Hypothèse centrale :** Les PM peuvent prendre de meilleures décisions produit s'ils ont accès à une compréhension conversationnelle de leur codebase.

**Comment valider :**
- Les PM reviennent utiliser l'outil (récurrence)
- Les PM se sentent plus confiants en réunion (qualitatif)
- Les tickets générés sont mieux accueillis par les devs (feedback)

## SaaS B2B Specific Requirements

### Architecture Compte & Utilisateur

**MVP : 1 compte = 1 utilisateur**
- Pas de gestion d'équipes
- Pas de système de rôles/permissions
- Un compte GitHub connecté = un utilisateur

### Modèle d'Abonnement

**MVP : Abonnement mensuel unique**
- Un seul tier : accès complet au produit
- Paiement mensuel récurrent
- Pas de freemium, pas de plans multiples (simplification MVP)

### Sécurité & Gestion du Code

**Principe : Zéro stockage du code source**

| Aspect | Approche MVP |
|--------|--------------|
| Stockage code | Aucun — lecture via API GitHub à la demande |
| Traitement | Transitoire — en mémoire pendant l'analyse uniquement |
| Persistance | Aucune donnée de code conservée après la requête |
| Contrôle utilisateur | Révocation possible via GitHub à tout moment |

**Message de confiance :** "Votre code n'est jamais stocké sur nos serveurs. Nous lisons via l'API GitHub et oublions tout après chaque analyse."

### Intégrations

**MVP :**
- GitHub OAuth (authentification + accès repos)

**Post-MVP :**
- Linear (génération de tickets)
- Notion (export de specs)

### Considérations Techniques

- **Rate limits GitHub API** — Prévoir cache court terme (quelques minutes) par session
- **Taille de repo** — Limiter initialement aux repos < 10k lignes
- **Latence** — Feedback visuel pendant les analyses longues

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Approche :** Experience MVP — délivrer l'expérience clé (la conversation avec le code) avec des fonctionnalités essentielles.

**Ressources :** Petite équipe, scope lean, développement itératif.

### Phase 1 — MVP (Lancement)

**Journeys supportés :** Sarah (sprint planning), Marc (due diligence), Julie (arbitrage roadmap)

**Capacités essentielles :**
- GitHub OAuth SSO
- 1 repo par compte
- Chat langage naturel
- Analyse de codebase (features, stack, schéma BDD)
- Analyse d'impact d'une feature
- Analyse dette technique
- Évaluation scalabilité
- Réponses précises + pédagogues (confiance binaire)
- Export conversations (PDF/Markdown)
- Abonnement mensuel simple

### Phase 2 — Growth (Post-validation)

- Intégration Linear (génération de tickets)
- Intégration Notion (export de specs)
- Support multi-repo
- Historique des conversations persistant

### Phase 3 — Expansion (Si traction)

- Suggestions proactives ("tu devrais regarder ce fichier")
- Génération specs dev-ready automatique
- Support équipes / multi-users
- Comparaison entre repos

### Risk Mitigation Strategy

| Risque | Type | Mitigation |
|--------|------|------------|
| Précision LLM sur analyse de code | Technique | Confiance binaire (< 80% → "je ne sais pas") |
| Les PM n'adoptent pas l'outil | Marché | Valider avec 5-10 PM avant de scaler |
| Développement plus long que prévu | Ressource | Scope ultra lean, pas de features bonus |
| Rate limits GitHub API | Technique | Cache court terme par session |
| Repos trop volumineux | Technique | Limite initiale < 10k lignes |

## Functional Requirements

### Authentification & Compte

- **FR1:** L'utilisateur peut s'authentifier via GitHub OAuth SSO
- **FR2:** L'utilisateur peut créer un compte lié à son compte GitHub
- **FR3:** L'utilisateur peut se déconnecter de son compte
- **FR4:** L'utilisateur peut supprimer son compte

### Connexion Repository

- **FR5:** L'utilisateur peut connecter un repository GitHub à son compte
- **FR6:** L'utilisateur peut voir la liste des repositories accessibles via son compte GitHub
- **FR7:** L'utilisateur peut changer de repository connecté
- **FR8:** L'utilisateur peut révoquer l'accès au repository

### Conversation & Interface Chat

- **FR9:** L'utilisateur peut poser une question en langage naturel
- **FR10:** L'utilisateur peut voir l'historique de la conversation en cours
- **FR11:** L'utilisateur peut démarrer une nouvelle conversation

### Analyse de Codebase

- **FR12:** L'utilisateur peut demander une vue d'ensemble des features principales du projet
- **FR13:** L'utilisateur peut demander la stack technique utilisée
- **FR14:** L'utilisateur peut demander le schéma de base de données
- **FR15:** L'utilisateur peut demander la structure des composants du projet
- **FR16:** L'utilisateur peut demander ce qui a été développé récemment (changelog)

### Analyse d'Impact

- **FR17:** L'utilisateur peut demander l'impact d'une feature sur le code existant
- **FR18:** Le système identifie les composants impactés par une modification
- **FR19:** Le système identifie les tables BDD impactées par une modification
- **FR20:** Le système signale les points de vigilance et dépendances critiques
- **FR21:** L'utilisateur peut comparer l'effort estimé entre plusieurs features

### Analyse Technique

- **FR22:** L'utilisateur peut demander une analyse de la dette technique
- **FR23:** Le système identifie les zones de risque dans le code
- **FR24:** Le système propose des recommandations d'amélioration
- **FR25:** L'utilisateur peut demander une évaluation de la scalabilité
- **FR26:** Le système identifie les points de contention potentiels

### Qualité des Réponses

- **FR27:** Le système répond avec un vocabulaire professionnel PM (pas de vulgarisation excessive)
- **FR28:** Le système explique ses réponses de manière pédagogue
- **FR29:** Le système affiche "je ne sais pas" quand sa certitude interne est insuffisante
- **FR30:** Le système cite les fichiers sources pertinents dans ses réponses
- **FR31:** Le système fournit un feedback visuel pendant les analyses longues

## Non-Functional Requirements

### Performance

| Type de requête | Temps de réponse max | Exemple |
|-----------------|---------------------|---------|
| Questions simples | 3 secondes | Stack technique, features principales |
| Analyses complexes | 30 secondes | Dette technique, analyse d'impact |

- **NFR1:** Les questions simples (stack, features, schéma) reçoivent une réponse en moins de 3 secondes
- **NFR2:** Les analyses complexes (dette technique, impact, scalabilité) reçoivent une réponse en moins de 30 secondes
- **NFR3:** Un feedback visuel (animation/loader) s'affiche pour toute requête > 2 secondes
- **NFR4:** L'utilisateur peut voir que le système "travaille" pendant les analyses longues

### Sécurité

- **NFR5:** Le code source n'est jamais stocké sur les serveurs — lecture via API GitHub uniquement
- **NFR6:** Les données de code sont traitées en mémoire et supprimées après chaque requête
- **NFR7:** L'authentification utilise OAuth 2.0 via GitHub (pas de mot de passe stocké)
- **NFR8:** Les tokens d'accès GitHub sont stockés de manière chiffrée
- **NFR9:** L'utilisateur peut révoquer l'accès à tout moment via GitHub

### Intégration GitHub

- **NFR10:** Le système respecte les rate limits de l'API GitHub
- **NFR11:** Un cache court terme (< 5 minutes) est utilisé pour éviter les appels redondants dans une session
- **NFR12:** Le système gère gracieusement les erreurs de l'API GitHub (timeout, indisponibilité)
- **NFR13:** Le système supporte les repositories jusqu'à 10 000 lignes de code (limite MVP)

### Fiabilité

- **NFR14:** Le système est disponible 99% du temps (hors maintenance planifiée)
- **NFR15:** En cas d'erreur, l'utilisateur reçoit un message explicatif (pas d'écran blanc)

