---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'epics-and-stories'
project_name: 'codebase-chat'
status: 'complete'
completedAt: '2026-01-09'
---

# codebase-chat - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for codebase-chat, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Authentification & Compte**
- FR1: L'utilisateur peut s'authentifier via GitHub OAuth SSO
- FR2: L'utilisateur peut créer un compte lié à son compte GitHub
- FR3: L'utilisateur peut se déconnecter de son compte
- FR4: L'utilisateur peut supprimer son compte

**Connexion Repository**
- FR5: L'utilisateur peut connecter un repository GitHub à son compte
- FR6: L'utilisateur peut voir la liste des repositories accessibles via son compte GitHub
- FR7: L'utilisateur peut changer de repository connecté
- FR8: L'utilisateur peut révoquer l'accès au repository

**Conversation & Interface Chat**
- FR9: L'utilisateur peut poser une question en langage naturel
- FR10: L'utilisateur peut voir l'historique de la conversation en cours
- FR11: L'utilisateur peut démarrer une nouvelle conversation

**Analyse de Codebase**
- FR12: L'utilisateur peut demander une vue d'ensemble des features principales du projet
- FR13: L'utilisateur peut demander la stack technique utilisée
- FR14: L'utilisateur peut demander le schéma de base de données
- FR15: L'utilisateur peut demander la structure des composants du projet
- FR16: L'utilisateur peut demander ce qui a été développé récemment (changelog)

**Analyse d'Impact**
- FR17: L'utilisateur peut demander l'impact d'une feature sur le code existant
- FR18: Le système identifie les composants impactés par une modification
- FR19: Le système identifie les tables BDD impactées par une modification
- FR20: Le système signale les points de vigilance et dépendances critiques
- FR21: L'utilisateur peut comparer l'effort estimé entre plusieurs features

**Analyse Technique**
- FR22: L'utilisateur peut demander une analyse de la dette technique
- FR23: Le système identifie les zones de risque dans le code
- FR24: Le système propose des recommandations d'amélioration
- FR25: L'utilisateur peut demander une évaluation de la scalabilité
- FR26: Le système identifie les points de contention potentiels

**Qualité des Réponses**
- FR27: Le système répond avec un vocabulaire professionnel PM (pas de vulgarisation excessive)
- FR28: Le système explique ses réponses de manière pédagogue
- FR29: Le système affiche "je ne sais pas" quand sa certitude interne est insuffisante
- FR30: Le système cite les fichiers sources pertinents dans ses réponses
- FR31: Le système fournit un feedback visuel pendant les analyses longues

### NonFunctional Requirements

**Performance**
- NFR1: Les questions simples (stack, features, schéma) reçoivent une réponse en moins de 3 secondes
- NFR2: Les analyses complexes (dette technique, impact, scalabilité) reçoivent une réponse en moins de 30 secondes
- NFR3: Un feedback visuel (animation/loader) s'affiche pour toute requête > 2 secondes
- NFR4: L'utilisateur peut voir que le système "travaille" pendant les analyses longues

**Sécurité**
- NFR5: Le code source n'est jamais stocké sur les serveurs — lecture via API GitHub uniquement
- NFR6: Les données de code sont traitées en mémoire et supprimées après chaque requête
- NFR7: L'authentification utilise OAuth 2.0 via GitHub (pas de mot de passe stocké)
- NFR8: Les tokens d'accès GitHub sont stockés de manière chiffrée
- NFR9: L'utilisateur peut révoquer l'accès à tout moment via GitHub

**Intégration GitHub**
- NFR10: Le système respecte les rate limits de l'API GitHub
- NFR11: Un cache court terme (< 5 minutes) est utilisé pour éviter les appels redondants dans une session
- NFR12: Le système gère gracieusement les erreurs de l'API GitHub (timeout, indisponibilité)
- NFR13: Le système supporte les repositories jusqu'à 10 000 lignes de code (limite MVP)

**Fiabilité**
- NFR14: Le système est disponible 99% du temps (hors maintenance planifiée)
- NFR15: En cas d'erreur, l'utilisateur reçoit un message explicatif (pas d'écran blanc)

### Additional Requirements

**Depuis l'Architecture :**

- **Starter Template** : `npx create-next-app@latest codebase-chat --typescript --tailwind --eslint --app --turbopack --import-alias "@/*"` — Epic 1 Story 1
- Infrastructure Supabase (Auth + PostgreSQL) obligatoire
- Vercel AI SDK avec Anthropic Claude pour le streaming SSE
- Prisma ORM pour la gestion de base de données
- Vercel KV (Redis) pour le cache GitHub API (5min TTL)
- Rate limiting via Edge Middleware + Upstash
- Structure de projet définie avec 90+ fichiers
- Patterns de nommage stricts (snake_case DB, PascalCase components, kebab-case API)
- Schéma de base de données : users, repositories, conversations, messages
- API Routes structure définie (/api/chat, /api/repos, /api/conversations, /api/export)

**Depuis l'UX Design :**

- Direction visuelle "Fun & Vibrant" avec dark mode par défaut
- Couleur dominante rose (#EC4899) avec glow effects
- shadcn/ui comme base de composants avec personnalisation
- Accessibilité WCAG 2.1 AA obligatoire (contraste 4.5:1, focus visible, touch targets 44x44px)
- Responsive design : Desktop-first (1024px+), Tablet (768-1023px), Mobile (320-767px)
- Composants custom requis : ChatMessage, CodeCitation, CodeBlock, AnalysisLoader, SuggestionChips, EmptyState, RepoSelector, TechTags
- Streaming des réponses (Claude-style)
- Citations inline cliquables pour la traçabilité
- Export one-click (PDF/Markdown) avec raccourci ⌘E
- Keyboard shortcuts : ⌘+Enter (envoyer), ⌘+B (toggle sidebar), ⌘+N (nouvelle conversation)
- Animation bouncing dots pour loading (pas juste pulse)
- Sidebar collapsible avec historique des conversations

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Authentification GitHub OAuth SSO |
| FR2 | Epic 1 | Création compte lié GitHub |
| FR3 | Epic 1 | Déconnexion |
| FR4 | Epic 1 | Suppression compte |
| FR5 | Epic 2 | Connecter repository |
| FR6 | Epic 2 | Liste repositories accessibles |
| FR7 | Epic 2 | Changer repository |
| FR8 | Epic 2 | Révoquer accès repository |
| FR9 | Epic 3 | Poser question langage naturel |
| FR10 | Epic 3 | Historique conversation en cours |
| FR11 | Epic 3 | Nouvelle conversation |
| FR12 | Epic 4 | Vue d'ensemble features |
| FR13 | Epic 4 | Stack technique |
| FR14 | Epic 4 | Schéma base de données |
| FR15 | Epic 4 | Structure composants |
| FR16 | Epic 4 | Changelog récent |
| FR17 | Epic 5 | Impact feature sur code |
| FR18 | Epic 5 | Composants impactés |
| FR19 | Epic 5 | Tables BDD impactées |
| FR20 | Epic 5 | Points vigilance, dépendances |
| FR21 | Epic 5 | Comparaison effort features |
| FR22 | Epic 5 | Analyse dette technique |
| FR23 | Epic 5 | Zones de risque |
| FR24 | Epic 5 | Recommandations amélioration |
| FR25 | Epic 5 | Évaluation scalabilité |
| FR26 | Epic 5 | Points contention potentiels |
| FR27 | Epic 3 | Vocabulaire professionnel PM |
| FR28 | Epic 3 | Réponses pédagogues |
| FR29 | Epic 3 | "Je ne sais pas" si incertain |
| FR30 | Epic 3 | Citations fichiers sources |
| FR31 | Epic 3 | Feedback visuel analyses longues |

## Epic List

### Epic 1: Fondation Projet & Authentification Utilisateur

Les utilisateurs peuvent créer un compte via GitHub OAuth et accéder à l'application.

**FRs couverts:** FR1, FR2, FR3, FR4

**Valeur utilisateur:** Première connexion, le PM peut accéder à l'app en 2 clics.

**Notes d'implémentation:**
- Initialisation projet via starter template (Architecture requirement)
- Setup Supabase (Auth + DB)
- Configuration GitHub OAuth
- UI login/logout

---

### Epic 2: Connexion Repository GitHub

Les utilisateurs peuvent connecter leur repository GitHub pour commencer l'analyse.

**FRs couverts:** FR5, FR6, FR7, FR8

**Valeur utilisateur:** Le PM a son codebase "branché" et prêt à interroger.

**Notes d'implémentation:**
- GitHub API integration
- Cache Vercel KV (5min TTL - NFR11)
- Rate limiting (NFR10)
- RepoSelector component (UX requirement)

---

### Epic 3: Interface Conversationnelle

Les utilisateurs peuvent poser des questions en langage naturel et recevoir des réponses en streaming.

**FRs couverts:** FR9, FR10, FR11, FR27, FR28, FR29, FR30, FR31

**Valeur utilisateur:** Le PM dialogue avec son code comme avec un collègue technique.

**Notes d'implémentation:**
- Chat UI components (ChatMessage, ChatInput, CodeCitation)
- Streaming SSE via Vercel AI SDK + Anthropic Claude
- Confiance binaire (certitude < 80% → "je ne sais pas")
- Citations inline cliquables
- AnalysisLoader pour feedback visuel (NFR3, NFR4)
- Sidebar avec historique conversations

---

### Epic 4: Analyse de Codebase

Les utilisateurs peuvent comprendre la structure et le contenu de leur codebase.

**FRs couverts:** FR12, FR13, FR14, FR15, FR16

**Valeur utilisateur:** Le PM peut répondre "C'est quoi la stack ?" en réunion sans hésiter.

**Notes d'implémentation:**
- Prompts spécialisés pour chaque type d'analyse
- Intégration avec l'Epic 3 (même interface chat)
- TechTags component pour visualisation stack

---

### Epic 5: Analyse d'Impact & Technique

Les utilisateurs peuvent évaluer l'impact des changements et la santé technique pour prendre des décisions éclairées.

**FRs couverts:** FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26

**Valeur utilisateur:** Le PM peut arbitrer la roadmap avec des données techniques (Julie), préparer une due diligence (Marc).

**Notes d'implémentation:**
- Analyse d'impact (composants, tables BDD)
- Comparaison effort entre features
- Dette technique avec zones de risque
- Évaluation scalabilité
- Recommandations d'amélioration

---

### Epic 6: Export & Partage

Les utilisateurs peuvent exporter leurs conversations pour les utiliser en réunion.

**FRs couverts:** Fonctionnalité MVP du PRD (pas de FR explicite)

**Valeur utilisateur:** Le PM arrive en réunion avec un rapport prêt à partager.

**Notes d'implémentation:**
- Export PDF
- Export Markdown
- Copie formatée dans presse-papier
- Raccourci ⌘E (UX requirement)
- ExportDialog component

---

## Epic 1: Fondation Projet & Authentification Utilisateur

Les utilisateurs peuvent créer un compte via GitHub OAuth et accéder à l'application.

### Story 1.1: Initialisation Projet & Infrastructure

**As a** développeur,
**I want** un projet Next.js initialisé avec toute l'infrastructure configurée,
**So that** je peux commencer à développer les fonctionnalités utilisateur.

**Acceptance Criteria:**

**Given** aucun projet existant
**When** j'exécute la commande d'initialisation du starter template
**Then** un projet Next.js 15+ est créé avec TypeScript, Tailwind, ESLint, App Router, Turbopack
**And** shadcn/ui est initialisé
**And** Supabase client est configuré (supabase-js, ssr)
**And** Prisma est initialisé avec le schéma de base (users table)
**And** Vercel AI SDK est installé
**And** les variables d'environnement sont documentées dans .env.example
**And** le projet se déploie sur Vercel avec succès

---

### Story 1.2: Authentification GitHub OAuth

**As a** PM ou entrepreneur,
**I want** me connecter avec mon compte GitHub en 2 clics,
**So that** j'accède à l'application sans créer de nouveau mot de passe.

**Acceptance Criteria:**

**Given** je suis sur la page de login
**When** je clique sur "Se connecter avec GitHub"
**Then** je suis redirigé vers GitHub pour autoriser l'application
**And** après autorisation, je suis redirigé vers le dashboard
**And** mon compte utilisateur est créé automatiquement dans la base de données
**And** ma session est persistée (cookie Supabase)

**Given** je suis déjà connecté
**When** j'accède à la page login
**Then** je suis redirigé vers le dashboard

**Given** l'autorisation GitHub échoue
**When** je suis redirigé vers l'app
**Then** un message d'erreur explicatif s'affiche
**And** je peux réessayer la connexion

---

### Story 1.3: Layout Application & Navigation

**As a** utilisateur connecté,
**I want** voir une interface cohérente avec sidebar et header,
**So that** je puisse naviguer facilement dans l'application.

**Acceptance Criteria:**

**Given** je suis connecté
**When** j'accède au dashboard
**Then** je vois le layout avec sidebar collapsible (280px)
**And** je vois le header avec mon avatar/nom GitHub
**And** le thème dark mode est appliqué par défaut
**And** les couleurs "Fun & Vibrant" (rose #EC4899) sont utilisées
**And** le raccourci ⌘+B toggle la sidebar

**Given** je suis sur mobile (< 768px)
**When** j'accède au dashboard
**Then** la sidebar est un drawer plein écran
**And** je peux swiper pour fermer

---

### Story 1.4: Déconnexion Utilisateur

**As a** utilisateur connecté,
**I want** me déconnecter de mon compte,
**So that** je sécurise ma session sur un ordinateur partagé.

**Acceptance Criteria:**

**Given** je suis connecté
**When** je clique sur mon avatar puis "Se déconnecter"
**Then** ma session Supabase est supprimée
**And** je suis redirigé vers la page de login
**And** les routes protégées ne sont plus accessibles

---

### Story 1.5: Suppression de Compte

**As a** utilisateur,
**I want** supprimer définitivement mon compte,
**So that** mes données sont effacées conformément au RGPD.

**Acceptance Criteria:**

**Given** je suis dans les paramètres de mon compte
**When** je clique sur "Supprimer mon compte"
**Then** une modale de confirmation s'affiche avec avertissement
**And** je dois taper "SUPPRIMER" pour confirmer

**Given** j'ai confirmé la suppression
**When** je valide
**Then** mon compte utilisateur est supprimé de la base de données
**And** mes repositories connectés sont dissociés
**And** mes conversations sont supprimées
**And** je suis déconnecté et redirigé vers la page de login
**And** un toast confirme "Compte supprimé"

---

## Epic 2: Connexion Repository GitHub

Les utilisateurs peuvent connecter leur repository GitHub pour commencer l'analyse.

### Story 2.1: Intégration GitHub API & Liste des Repositories

**As a** utilisateur connecté,
**I want** voir la liste de mes repositories GitHub accessibles,
**So that** je puisse choisir celui que je veux analyser.

**Acceptance Criteria:**

**Given** je suis connecté avec GitHub OAuth
**When** j'accède à la page de sélection de repository
**Then** la liste de mes repositories GitHub s'affiche
**And** chaque repo montre : nom, description, langage principal, dernière mise à jour
**And** je peux rechercher/filtrer dans la liste
**And** les repos sont triés par dernière activité

**Given** j'ai déjà chargé la liste récemment (< 5 min)
**When** je recharge la page
**Then** la liste est servie depuis le cache Vercel KV
**And** aucun appel GitHub API n'est effectué

**Given** l'API GitHub est indisponible
**When** je tente de charger la liste
**Then** un message d'erreur explicatif s'affiche
**And** je peux réessayer

---

### Story 2.2: Connexion d'un Repository

**As a** utilisateur,
**I want** connecter un repository à mon compte,
**So that** je puisse commencer à poser des questions sur ce code.

**Acceptance Criteria:**

**Given** je vois la liste de mes repositories
**When** je clique sur un repository pour le connecter
**Then** le repository est enregistré dans ma base de données (table repositories)
**And** les métadonnées sont stockées (full_name, default_branch)
**And** je suis redirigé vers l'interface de chat
**And** un toast confirme "Repository connecté"

**Given** le repository dépasse 10 000 lignes de code
**When** je tente de le connecter
**Then** un avertissement s'affiche expliquant la limite MVP
**And** je peux quand même procéder (avec disclaimer)

**Given** j'ai déjà un repository connecté (MVP = 1 repo)
**When** je connecte un nouveau repository
**Then** l'ancien repository est remplacé par le nouveau
**And** les conversations précédentes restent accessibles

---

### Story 2.3: Affichage Repository Actif & Sélecteur

**As a** utilisateur avec un repo connecté,
**I want** voir clairement quel repository est actif et pouvoir en changer,
**So that** je sache toujours sur quel code je travaille.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** je suis sur le dashboard ou le chat
**Then** le RepoSelector dans le header affiche le repo actif (owner/name)
**And** un badge montre la branche par défaut
**And** des TechTags colorés affichent les technologies détectées

**Given** je clique sur le RepoSelector
**When** le dropdown s'ouvre
**Then** je vois l'option de changer de repository
**And** je peux accéder directement à la liste des repos

---

### Story 2.4: Déconnexion d'un Repository

**As a** utilisateur,
**I want** déconnecter un repository de mon compte,
**So that** je puisse révoquer l'accès si nécessaire.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** je vais dans les paramètres et clique "Déconnecter le repository"
**Then** une confirmation est demandée

**Given** je confirme la déconnexion
**When** je valide
**Then** le repository est supprimé de ma base de données
**And** je suis redirigé vers la page de sélection de repository
**And** un toast confirme "Repository déconnecté"
**And** mes conversations passées restent accessibles en lecture seule

---

## Epic 3: Interface Conversationnelle

Les utilisateurs peuvent poser des questions en langage naturel et recevoir des réponses en streaming.

### Story 3.1: Interface Chat de Base

**As a** utilisateur avec un repo connecté,
**I want** voir une interface de chat claire et moderne,
**So that** je puisse interagir naturellement avec mon code.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** j'accède à l'interface de chat
**Then** je vois un conteneur de chat centré (max 800px)
**And** un champ de saisie en bas avec placeholder "Posez une question sur votre code..."
**And** le champ s'agrandit automatiquement (auto-resize jusqu'à 200px)
**And** je peux envoyer avec ⌘+Enter ou le bouton d'envoi
**And** le design "Fun & Vibrant" est appliqué (dark mode, accents roses)

**Given** aucune conversation n'existe
**When** j'arrive sur le chat
**Then** un EmptyState s'affiche avec titre en gradient
**And** des SuggestionChips proposent des questions de départ
**And** l'icône a un effet glow pulsé

---

### Story 3.2: Envoi de Messages & Streaming des Réponses

**As a** utilisateur,
**I want** poser une question et voir la réponse apparaître progressivement,
**So that** l'attente soit réduite et l'interaction soit fluide.

**Acceptance Criteria:**

**Given** je suis sur l'interface de chat
**When** j'envoie une question
**Then** mon message apparaît immédiatement (bulle rose avec glow)
**And** un TypingIndicator avec dots qui bounce s'affiche
**And** la réponse de l'assistant apparaît en streaming (mot par mot)
**And** le message assistant a un fond transparent, aligné à gauche

**Given** la réponse est en cours de streaming
**When** je scrolle vers le haut
**Then** le scroll automatique vers le bas s'arrête
**And** un bouton "Retour en bas" apparaît

**Given** l'API Claude est indisponible
**When** j'envoie un message
**Then** un message d'erreur explicatif s'affiche
**And** je peux réessayer

---

### Story 3.3: Persistance & Historique de Conversation

**As a** utilisateur,
**I want** que mes messages soient sauvegardés et visibles dans l'historique,
**So that** je puisse reprendre une conversation où je l'ai laissée.

**Acceptance Criteria:**

**Given** j'envoie un message et reçois une réponse
**When** les messages sont échangés
**Then** ils sont persistés dans la base de données (table messages)
**And** la conversation est créée si c'est le premier message (table conversations)
**And** le titre de la conversation est auto-généré depuis le premier message

**Given** je reviens sur une conversation existante
**When** la page se charge
**Then** l'historique complet des messages s'affiche
**And** les messages sont dans l'ordre chronologique
**And** je peux continuer la conversation

---

### Story 3.4: Création de Nouvelle Conversation

**As a** utilisateur,
**I want** démarrer une nouvelle conversation à tout moment,
**So that** je puisse poser des questions sur un nouveau sujet.

**Acceptance Criteria:**

**Given** je suis dans une conversation existante
**When** je clique sur "Nouvelle conversation" ou ⌘+N
**Then** une nouvelle conversation vide est créée
**And** l'EmptyState avec suggestions s'affiche
**And** l'ancienne conversation reste accessible dans la sidebar

**Given** je clique sur une suggestion dans l'EmptyState
**When** la suggestion est sélectionnée
**Then** le texte de la suggestion est inséré dans le champ de saisie
**And** je peux modifier avant d'envoyer ou envoyer directement

---

### Story 3.5: Liste des Conversations dans la Sidebar

**As a** utilisateur,
**I want** voir la liste de mes conversations passées dans la sidebar,
**So that** je puisse naviguer entre mes différentes sessions de questions.

**Acceptance Criteria:**

**Given** j'ai plusieurs conversations
**When** je regarde la sidebar
**Then** les conversations sont listées avec leur titre et un emoji
**And** elles sont groupées par date (Aujourd'hui, Hier, Cette semaine, etc.)
**And** la conversation active est mise en évidence

**Given** je clique sur une conversation dans la liste
**When** je la sélectionne
**Then** le chat affiche l'historique de cette conversation
**And** je peux continuer à poser des questions

**Given** je survole une conversation
**When** le hover est actif
**Then** un bouton de suppression apparaît
**And** je peux supprimer la conversation avec confirmation

---

### Story 3.6: Qualité des Réponses & Confiance Binaire

**As a** PM ou entrepreneur,
**I want** des réponses professionnelles et honnêtes sur leurs limites,
**So that** je puisse faire confiance aux informations et les utiliser en réunion.

**Acceptance Criteria:**

**Given** je pose une question sur le code
**When** le système répond
**Then** le vocabulaire est professionnel (adapté aux PMs, pas vulgarisé)
**And** les explications sont pédagogues (pas juste des faits, mais du contexte)
**And** le système ne dit jamais "peut-être" ou "probablement" avec un pourcentage

**Given** la certitude interne du LLM est < 80%
**When** le système génère une réponse
**Then** il répond "Je ne suis pas en mesure de répondre avec certitude à cette question"
**And** il suggère comment reformuler ou quelles infos manquent

**Given** la certitude est >= 80%
**When** le système répond
**Then** la réponse est affirmative et directe
**And** aucune mention de niveau de confiance n'apparaît

---

### Story 3.7: Citations de Code Inline

**As a** utilisateur,
**I want** voir les fichiers sources cités dans les réponses,
**So that** je puisse vérifier l'information et gagner en confiance.

**Acceptance Criteria:**

**Given** la réponse fait référence à du code
**When** le message est affiché
**Then** les fichiers sont cités en inline avec le composant CodeCitation
**And** le format est `[src/auth.ts:42]` dans une pill rose avec border
**And** l'icône fichier et le badge extension coloré sont visibles

**Given** je survole une citation
**When** le hover est actif
**Then** la pill scale à 1.02 avec glow rose
**And** un tooltip montre un aperçu du code (optionnel MVP)

**Given** je clique sur une citation
**When** l'action est déclenchée
**Then** le chemin du fichier est copié dans le presse-papier
**And** un toast confirme "Copié !"

---

### Story 3.8: Feedback Visuel pour Analyses Longues

**As a** utilisateur,
**I want** voir ce que le système fait pendant les analyses longues,
**So that** je sache qu'il travaille et ne pense pas qu'il a planté.

**Acceptance Criteria:**

**Given** une requête prend plus de 2 secondes
**When** l'analyse est en cours
**Then** l'AnalysisLoader s'affiche avec une icône animée
**And** un message contextuel indique l'étape ("Analyse en cours...", "Lecture des fichiers...")
**And** des détails progressifs apparaissent ("847 fichiers analysés dans 12 dossiers")

**Given** l'analyse est complexe (dette technique, impact)
**When** le temps dépasse 5 secondes
**Then** les chiffres s'incrémentent visuellement
**And** l'icône a un glow pulsé rose
**And** les dots bounce (pas juste pulse)

**Given** l'analyse atteint 30 secondes
**When** le timeout approche
**Then** un message indique "Cette analyse prend plus de temps que prévu..."
**And** l'utilisateur peut annuler si souhaité

---

## Epic 4: Analyse de Codebase

Les utilisateurs peuvent comprendre la structure et le contenu de leur codebase.

### Story 4.1: Vue d'Ensemble des Features du Projet

**As a** PM,
**I want** demander quelles sont les features principales de mon projet,
**So that** je comprenne rapidement ce que fait l'application.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** je demande "C'est quoi les features principales ?" ou équivalent
**Then** le système analyse le code et répond avec une liste structurée des features
**And** chaque feature est expliquée en termes métier (pas techniques)
**And** les fichiers/dossiers clés sont cités pour chaque feature
**And** la réponse arrive en moins de 30 secondes

**Given** le repository est vide ou minimal
**When** je demande les features
**Then** le système indique qu'il n'y a pas assez de code pour identifier des features
**And** il suggère ce qu'il faudrait pour avoir une analyse pertinente

---

### Story 4.2: Détection de la Stack Technique

**As a** PM ou entrepreneur,
**I want** connaître la stack technique de mon projet,
**So that** je puisse en parler avec assurance en réunion.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** je demande "C'est quoi la stack technique ?" ou équivalent
**Then** le système répond avec la liste des technologies détectées
**And** les technologies sont catégorisées (Frontend, Backend, Database, DevOps, etc.)
**And** les versions sont mentionnées si détectables (package.json, etc.)
**And** la réponse arrive en moins de 3 secondes (question simple)

**Given** la stack est détectée
**When** la réponse est affichée
**Then** les TechTags colorés sont mis à jour dans le header
**And** chaque tag a sa couleur par catégorie (React=bleu, Node=vert, etc.)

---

### Story 4.3: Analyse du Schéma de Base de Données

**As a** PM,
**I want** comprendre la structure de la base de données,
**So that** je puisse discuter des données avec l'équipe technique.

**Acceptance Criteria:**

**Given** j'ai un repository avec une base de données (Prisma, migrations SQL, etc.)
**When** je demande "C'est quoi le schéma de la BDD ?" ou équivalent
**Then** le système liste les tables/entités principales
**And** pour chaque table, les champs importants sont décrits
**And** les relations entre tables sont expliquées simplement
**And** un diagramme textuel simplifié est fourni si pertinent

**Given** le projet n'a pas de base de données détectable
**When** je demande le schéma
**Then** le système indique qu'aucune BDD n'a été détectée
**And** il mentionne ce qu'il a cherché (Prisma, SQL, etc.)

---

### Story 4.4: Structure des Composants du Projet

**As a** PM,
**I want** comprendre comment le projet est organisé,
**So that** je sache où se trouvent les différentes parties de l'application.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** je demande "Comment est structuré le projet ?" ou équivalent
**Then** le système décrit l'architecture des dossiers principaux
**And** chaque dossier/module est expliqué en termes de fonction
**And** les patterns architecturaux sont identifiés (MVC, Clean Architecture, etc.)
**And** les points d'entrée de l'application sont indiqués

**Given** le projet utilise un framework connu (Next.js, React, etc.)
**When** je demande la structure
**Then** le système contextualise avec les conventions du framework
**And** il distingue le code standard framework du code custom

---

### Story 4.5: Changelog & Développements Récents

**As a** PM,
**I want** savoir ce qui a été développé récemment,
**So that** je suive l'avancement sans lire les commits.

**Acceptance Criteria:**

**Given** j'ai un repository connecté avec historique Git
**When** je demande "Qu'est-ce qui a été développé récemment ?" ou équivalent
**Then** le système analyse les commits récents (dernière semaine/mois)
**And** il résume les changements par catégorie (features, fixes, refacto)
**And** les fichiers les plus modifiés sont mentionnés
**And** les contributeurs principaux sont identifiés

**Given** je veux plus de détails sur une période
**When** je demande "Qu'est-ce qui a changé cette semaine ?" ou "le mois dernier ?"
**Then** le système ajuste son analyse à la période demandée
**And** il compare avec la période précédente si pertinent

**Given** le repository n'a pas d'historique Git accessible
**When** je demande le changelog
**Then** le système indique que l'historique n'est pas disponible
**And** il suggère de vérifier les permissions ou la configuration

---

## Epic 5: Analyse d'Impact & Technique

Les utilisateurs peuvent évaluer l'impact des changements et la santé technique pour prendre des décisions éclairées.

### Story 5.1: Analyse d'Impact d'une Feature

**As a** PM (comme Sarah),
**I want** savoir l'impact d'ajouter une feature sur le code existant,
**So that** je puisse estimer la complexité et préparer mon sprint planning.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** je demande "Si j'ajoute des notifications push, ça impacte quoi ?" ou équivalent
**Then** le système analyse le code et liste les composants impactés
**And** les fichiers concernés sont cités avec CodeCitation
**And** les tables BDD qui seraient modifiées sont identifiées
**And** une estimation de l'ampleur (faible/moyenne/importante) est fournie

**Given** la feature demandée est complexe
**When** l'analyse est en cours
**Then** l'AnalysisLoader affiche la progression
**And** la réponse arrive en moins de 30 secondes

**Given** la feature n'est pas claire
**When** le système ne peut pas analyser
**Then** il demande des précisions sur ce que l'utilisateur veut ajouter

---

### Story 5.2: Points de Vigilance & Dépendances Critiques

**As a** PM,
**I want** connaître les risques et dépendances d'une modification,
**So that** je puisse anticiper les problèmes potentiels.

**Acceptance Criteria:**

**Given** je demande une analyse d'impact
**When** le système répond
**Then** les points de vigilance sont clairement signalés (icône warning)
**And** les dépendances critiques sont listées (ex: "impacte le système d'auth")
**And** les effets de bord potentiels sont mentionnés
**And** le niveau de risque est indiqué (faible/moyen/élevé)

**Given** une modification touche un composant critique
**When** le système détecte ce cas
**Then** un avertissement explicite est affiché
**And** des recommandations de précaution sont fournies

---

### Story 5.3: Comparaison d'Effort entre Features

**As a** Head of Product (comme Julie),
**I want** comparer l'effort requis entre plusieurs features,
**So that** je puisse arbitrer la roadmap avec des données objectives.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** je demande "Compare l'effort pour : intégration Salesforce, refonte dashboard, système de tickets"
**Then** le système analyse chaque feature séparément
**And** un tableau comparatif est fourni avec :
  - Nombre de composants impactés
  - Complexité estimée (1-5)
  - Dépendances identifiées
  - Risques principaux
**And** une recommandation de priorité est suggérée

**Given** une des features est trop vague
**When** le système ne peut pas comparer équitablement
**Then** il demande des précisions sur cette feature spécifique
**And** il analyse les autres en attendant

---

### Story 5.4: Analyse de la Dette Technique

**As a** entrepreneur (comme Marc),
**I want** obtenir une analyse complète de la dette technique,
**So that** je puisse paraître crédible face aux investisseurs.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** je demande "Analyse la dette technique de ce projet"
**Then** le système fournit un rapport structuré avec :
  - Score global de santé (A à F ou pourcentage)
  - Zones critiques identifiées (rouge)
  - Zones à surveiller (orange)
  - Points positifs (vert)
**And** chaque zone est accompagnée de fichiers cités
**And** le rapport est présentable tel quel (prêt pour l'export)

**Given** l'analyse prend du temps
**When** le système travaille
**Then** l'AnalysisLoader montre "Analyse des patterns de code..."
**And** le feedback est informatif et rassurant

---

### Story 5.5: Recommandations d'Amélioration

**As a** PM ou entrepreneur,
**I want** des recommandations concrètes pour améliorer le code,
**So that** je puisse planifier des actions correctives.

**Acceptance Criteria:**

**Given** une analyse de dette technique a été effectuée
**When** le système présente les résultats
**Then** chaque zone problématique inclut une recommandation d'action
**And** les recommandations sont priorisées (quick wins vs efforts majeurs)
**And** l'impact de chaque correction est estimé

**Given** je demande "Comment améliorer [zone spécifique] ?"
**When** le système répond
**Then** il fournit des étapes concrètes et actionnables
**And** il cite les fichiers à modifier
**And** il estime l'effort requis

---

### Story 5.6: Évaluation de la Scalabilité

**As a** entrepreneur (comme Marc),
**I want** savoir si mon architecture peut supporter 10x plus d'utilisateurs,
**So that** je puisse répondre aux questions des investisseurs sur la scalabilité.

**Acceptance Criteria:**

**Given** j'ai un repository connecté
**When** je demande "Est-ce que l'architecture peut tenir 10x plus d'utilisateurs ?"
**Then** le système analyse les points de contention potentiels :
  - Requêtes BDD non optimisées
  - Absence de cache
  - Goulots d'étranglement
  - Dépendances synchrones problématiques
**And** chaque point est expliqué en termes compréhensibles
**And** des solutions sont suggérées

**Given** l'architecture a des limites claires
**When** le système les identifie
**Then** il les présente honnêtement (pas d'embellissement)
**And** il distingue ce qui est facile à corriger vs nécessite une refonte

---

## Epic 6: Export & Partage

Les utilisateurs peuvent exporter leurs conversations pour les utiliser en réunion.

### Story 6.1: Export en Markdown

**As a** PM,
**I want** exporter ma conversation en Markdown,
**So that** je puisse l'intégrer dans mes documents (Notion, Confluence, etc.).

**Acceptance Criteria:**

**Given** j'ai une conversation avec des messages
**When** je clique sur Export puis "Markdown"
**Then** un fichier .md est téléchargé automatiquement
**And** le fichier contient :
  - Le titre de la conversation
  - La date d'export
  - Le repository concerné
  - Tous les messages (user/assistant) formatés en Markdown
  - Les citations de code préservées avec liens
**And** un toast confirme "Export Markdown téléchargé"

**Given** je suis sur mobile
**When** j'exporte en Markdown
**Then** le fichier est proposé au téléchargement ou partage natif

---

### Story 6.2: Export en PDF

**As a** PM ou entrepreneur,
**I want** exporter ma conversation en PDF,
**So that** je puisse la partager en réunion ou l'envoyer par email.

**Acceptance Criteria:**

**Given** j'ai une conversation avec des messages
**When** je clique sur Export puis "PDF"
**Then** un fichier .pdf est généré et téléchargé
**And** le PDF a un design professionnel avec :
  - Header avec logo/nom du produit
  - Titre de la conversation
  - Date et repository
  - Messages bien formatés avec distinction user/assistant
  - Blocs de code avec syntax highlighting
  - Citations visibles
  - Footer avec numéro de page
**And** un toast confirme "Export PDF téléchargé"

**Given** la conversation est très longue
**When** j'exporte en PDF
**Then** le PDF gère correctement la pagination
**And** les blocs de code ne sont pas coupés au milieu

---

### Story 6.3: Copie dans le Presse-Papier

**As a** utilisateur,
**I want** copier rapidement une conversation ou un message,
**So that** je puisse le coller ailleurs immédiatement.

**Acceptance Criteria:**

**Given** je suis sur une conversation
**When** je clique sur Export puis "Copier"
**Then** le contenu formaté est copié dans le presse-papier
**And** un toast confirme "Copié dans le presse-papier"
**And** le formatage Markdown est préservé pour coller dans Notion/Slack

**Given** je survole un message individuel
**When** je clique sur l'icône "Copier" du message
**Then** ce message seul est copié
**And** un toast confirme "Message copié"

---

### Story 6.4: Raccourci Clavier & Bouton Export Visible

**As a** utilisateur power-user,
**I want** accéder à l'export rapidement via un raccourci,
**So that** je gagne du temps dans mon workflow.

**Acceptance Criteria:**

**Given** je suis sur une conversation
**When** j'appuie sur ⌘+E (ou Ctrl+E sur Windows)
**Then** le dialog d'export s'ouvre immédiatement
**And** je peux choisir le format (PDF, Markdown, Copier)

**Given** je suis sur l'interface de chat
**When** je regarde le header
**Then** le bouton Export est toujours visible (pas caché dans un menu)
**And** le raccourci ⌘E est affiché à côté du bouton

**Given** la conversation est vide
**When** je tente d'exporter
**Then** le bouton Export est désactivé
**And** un tooltip explique "Démarrez une conversation pour exporter"

