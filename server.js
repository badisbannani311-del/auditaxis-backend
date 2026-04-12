require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS
const corsOptions = {
    origin: [
        'https://auditaxisqse.netlify.app',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Rate limiting global: 100 requêtes par 15 minutes
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        error: 'RATE_LIMIT',
        message: 'Trop de requêtes. Veuillez réessayer plus tard.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(globalLimiter);

// Rate limiting strict pour /api/diagnostic: 10 requêtes par 15 minutes
const diagnosticLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        error: 'RATE_LIMIT_STRICT',
        message: 'Limite de requêtes atteinte pour le diagnostic. Veuillez réessayer dans 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Import des routes
const diagnosticRouter = require('./routes/diagnostic');
const checklistRouter = require('./routes/checklist');
const contactRouter = require('./routes/contact');

// Routes API
app.use('/api/diagnostic', diagnosticLimiter, diagnosticRouter);
app.use('/api/checklist', checklistRouter);
app.use('/api/contact', contactRouter);

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
    });
});

// Route racine
app.get('/', (req, res) => {
    res.json({
        name: 'AuditAxis QSE Backend',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            diagnostic: '/api/diagnostic',
            checklist: '/api/checklist',
            contact: '/api/contact',
        },
    });
});

// Gestionnaire 404
app.use((req, res) => {
    res.status(404).json({
        error: 'ROUTE_NON_TROUVEE',
        message: 'Route non trouvée',
        path: req.path,
    });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err);

    // Erreur de parsing JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            error: 'JSON_INVALIDE',
            message: 'Le corps de la requête contient du JSON invalide',
        });
    }

    // Erreur Anthropic 401
    if (err.status === 401 || err.message?.includes('ANTHROPIC_AUTH_ERROR')) {
        return res.status(401).json({
            error: 'AUTH_ERROR',
            message: 'Erreur d\'authentification avec le service d\'analyse',
        });
    }

    // Erreur Anthropic 429
    if (err.status === 429 || err.message?.includes('ANTHROPIC_RATE_LIMIT')) {
        return res.status(429).json({
            error: 'RATE_LIMIT',
            message: 'Trop de requêtes vers le service d\'analyse. Veuillez réessayer plus tard.',
        });
    }

    // Erreur par défaut
    res.status(err.status || 500).json({
        error: 'ERREUR_SERVEUR',
        message: process.env.NODE_ENV === 'production'
            ? 'Une erreur est survenue'
            : err.message || 'Erreur interne du serveur',
    });
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log('🚀 Serveur AuditAxis QSE démarré');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('Routes disponibles:');
    console.log('  POST /api/diagnostic  - Analyse QSE avec IA');
    console.log('  POST /api/checklist/save - Sauvegarder checklist');
    console.log('  GET  /api/checklist/:id  - Récupérer checklist');
    console.log('  POST /api/contact       - Envoyer message');
    console.log('  GET  /api/health        - Vérification santé');
    console.log('');
});

module.exports = app;
