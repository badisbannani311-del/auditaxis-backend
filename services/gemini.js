const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuration du client Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analyse un diagnostic QSE en appelant Gemini Flash
 * @param {string} norme - La norme ISO (ISO 9001:2015, ISO 14001:2015, ISO 45001:2018)
 * @param {string} description - La description de la situation
 * @returns {Promise<Object>} - Le résultat structuré du diagnostic
 */
async function analyserDiagnostic(norme, description) {
    const prompt = `Tu es un auditeur QSE expert certifié, spécialisé dans les normes ISO 9001:2015, ISO 14001:2015 et ISO 45001:2018.

NORME À ANALYSER: ${norme}

SITUATION DE L'ENTREPRISE:
${description}

INSTRUCTIONS STRICTES:

1. RÔLE ET MÉTHODE:
   - Agis comme un auditeur certifié rigoureux et impartial
   - Pour CHAQUE élément de la description, identifie l'article de la norme applicable (ex: Art. 6.1, Art. 7.2, Art. 8.1)
   - Statue systématiquement: Conforme / Partiellement conforme / Non conforme
   - Justifie chaque constat par une référence normative EXPLICITE

2. INTERDICTION D'INVENTION:
   - NE statue JAMAIS sur un élément si la norme ne l'exige pas explicitement
   - NE crée pas d'exigences absentes de la norme sélectionnée
   - Si un élément n'est pas couvert par ${norme}, ignore-le purement et simplement

3. RÈGLE DE GRAVITÉ:
   - MAJEURE: si l'article manquant ou non conforme relève des chapitres 4, 5, 6 ou 7 de la norme (Contexte, Leadership, Planification, Support)
   - MINEURE: si l'article relève des chapitres 8, 9 ou 10 (Opération, Évaluation, Amélioration)

4. CALCUL DU SCORE:
   score = ((éléments conformes + 0.5 × éléments partiels) / total des exigences vérifiées) × 100
   Arrondir à l'entier le plus proche (0-100)

5. FORMAT DE SORTIE OBLIGATOIRE:
RÉponds UNIQUEMENT avec le JSON suivant, sans markdown, sans texte avant ou après:

{
  "score": <integer 0-100>,
  "non_conformites": [
    {
      "titre": <string>,
      "article": <string, ex: "Art. 6.1.2">,
      "gravite": <"MAJEURE" | "MINEURE">,
      "probleme": <string, description factuelle>,
      "explication": <string, citer l'exigence normative exacte de ${norme}>,
      "action_corrective": <string, action concrète et réalisable>
    }
  ],
  "conformites": [
    {
      "description": <string, description du point contrôlé>,
      "article": <string, référence article ISO>,
      "statut": <"Conforme" | "Partiel">
    }
  ],
  "recommandations": [
    {
      "action": <string, action recommandée>,
      "priorite": <"URGENT" | "MOYEN" | "LONG_TERME">,
      "benefice": <string, bénéfice attendu>
    }
  ]
}

N.B.: Si aucune non-conformité n'est détectée, renvoie un tableau vide pour non_conformites.
Assure-toi que le JSON est STRICTEMENT valide sans commentaires ni texte supplémentaire.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await model.generateContent(prompt);
        const response = result.response;
        let content = response.text();

        // Nettoyer le JSON si enveloppé dans des balises markdown
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parser le JSON
        const parsedResult = JSON.parse(content);

        // Validation de la structure
        if (!parsedResult || typeof parsedResult.score !== 'number') {
            throw new SyntaxError('Structure JSON invalide: score manquant');
        }

        return parsedResult;
    } catch (error) {
        // Gestion des erreurs spécifiques de Gemini
        if (error.message?.includes('API key')) {
            throw new Error('GEMINI_AUTH_ERROR: Clé API invalide');
        }
        if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
            throw new Error('GEMINI_RATE_LIMIT: Trop de requêtes');
        }
        if (error instanceof SyntaxError) {
            throw new Error('JSON_PARSE_ERROR: Réponse invalide de l\'API');
        }
        throw error;
    }
}

module.exports = {
    analyserDiagnostic,
};
