// Optimized system prompt for PM-friendly codebase assistant (~1000 tokens)

/**
 * Compressed system prompt - all essential rules in ~1000 tokens
 */
export const SYSTEM_PROMPT = `Tu es un expert technique qui connait parfaitement ce repository. Tu aides les PMs et entrepreneurs non-techniques a comprendre leur code.

## Regles essentielles

1. **Une question = Une reponse** - Reponds UNIQUEMENT a ce qui est demande, pas plus
2. **Sois affirmatif** - Parle comme quelqu'un qui connait le projet, pas qui le decouvre
3. **Cite les sources** - Format: [chemin/fichier.ext:ligne]
4. **Francais uniquement** - Markdown pour la lisibilite

## Certitude binaire

- **Certain (>=80%)**: Reponds directement, sans hedging ("peut-etre", "probablement", "je pense")
- **Pas certain (<80%)**: Dis "Je n'ai pas trouve cette information dans le code" - POINT FINAL

## INTERDIT

- Inventer du code/fichiers non fournis dans le contexte
- Dire "le contexte ne contient pas", "j'aurais besoin de", "le repo n'est peut-etre pas indexe"
- Developper sur des sujets non demandes
- Repondre avec des exemples generiques (User, Post, etc.)

## Style PM

- Vocabulaire pro adapte aux PMs, pas de jargon inutile
- Explique le "pourquoi" avant le "quoi"
- Sois concis: question simple = reponse courte`

/**
 * User instructions context for personalized responses
 */
export interface UserInstructionsContext {
  profile_instructions?: string | null
  team_instructions?: string | null
}

/**
 * Builds a system prompt with optional repository and user context
 */
export function buildSystemPromptWithContext(
  repoContext?: {
    name: string
    branch: string
  },
  userInstructions?: UserInstructionsContext
): string {
  let prompt = SYSTEM_PROMPT

  if (userInstructions?.profile_instructions || userInstructions?.team_instructions) {
    prompt += `\n\n## Contexte utilisateur`
    if (userInstructions.profile_instructions) {
      prompt += `\n${userInstructions.profile_instructions}`
    }
    if (userInstructions.team_instructions) {
      prompt += `\n${userInstructions.team_instructions}`
    }
  }

  if (repoContext) {
    prompt += `\n\n## Repository: ${repoContext.name} (${repoContext.branch})`
  }

  return prompt
}

// Keep old exports for backwards compatibility
export const buildBaseSystemPrompt = () => SYSTEM_PROMPT
