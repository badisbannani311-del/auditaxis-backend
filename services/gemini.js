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
    const prompt = `Tu es un expert en audit QSE (Qualité, Sécurité, Environnement). Analyse la situation suivante selon la norme ${norme}.

SITUATION DE L'ENTREPRISE:
${description}

INSTRUCTIONS:
1. Analyse cette situation selon les exigences de la norme ${norme}
2. Identifie les non-conformités (NC) majeures et mineures
3. Identifie les points de conformité
4. Propose des recommandations priorisées

RÈGLES DE GRAVITÉ:
- Articles 4-7 (Contexte, Leadership, Planification, Support) = MAJEURE si non-conforme
- Articles 8-10 (Opération, Évaluation, Amélioration) = MINEURE si non-conforme

Réponds UNIQUEMENT en JSON valide selon ce format exact:

{
  "score": number, // Score global 0-100
  "non_conformites": [
    {
      "titre": "string", // Titre de la non-conformité
      "article": "string", // Référence article ISO (ex: "Art. 5.1")
      "gravite": "MAJEURE|MINEURE",
      "probleme": "string", // Description du problème
      "explication": "string", // Explication détaillée
      "action_corrective": "string" // Action corrective proposée
    }
  ],
  "conformites": [
    {
      "description": "string", // Description du point conforme
      "article": "string", // Référence article ISO
      "statut": "CONFORME|PARTIEL" // Statut de conformité
    }
  ],
  "recommandations": [
    {
      "action": "string", // Action recommandée
      "priorite": "URGENT|MOYEN|LONG", // Priorité
      "benefice": "string" // Bénéfice attendu
    }
  ],
  "resume": "string" // Résumé global de l'analyse (2-3 phrases)
}

Si aucune non-conformité n'est détectée, renvoie un tableau vide pour non_conformites.
Si tout est conforme, score = 100. Assure-toi que le JSON est valide sans commentaires.`;

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
