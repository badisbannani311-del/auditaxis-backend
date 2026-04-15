require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────
// CONFIGURATION CORS
// ─────────────────────────────────────────────

app.use(cors({
    origin: [
        'https://auditaxis-frontend.vercel.app',
        'https://auditaxis-qse.com',
        'http://localhost:8000',
        'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true,
}));

app.use(express.json());

// ─────────────────────────────────────────────
// RATE LIMITERS (SÉCURITÉ)
// ─────────────────────────────────────────────

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'RATE_LIMIT', message: 'Trop de requêtes. Réessayez plus tard.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(globalLimiter);

const diagnosticLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'RATE_LIMIT_STRICT', message: 'Limite diagnostic atteinte. Réessayez dans 15 min.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─────────────────────────────────────────────
// IMPORT ET USAGE DES ROUTES
// ─────────────────────────────────────────────

const diagnosticRouter = require('./routes/diagnostic');
const checklistRouter = require('./routes/checklist');

app.use('/api/diagnostic', diagnosticLimiter, diagnosticRouter);
app.use('/api/checklist', checklistRouter);

// ─────────────────────────────────────────────
// POST /api/contact — FORMULAIRE DE CONTACT
// ─────────────────────────────────────────────

app.post('/api/contact', async (req, res) => {
    const { nom, email, sujet, message, company } = req.body;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validations
    if (!nom || typeof nom !== 'string' || nom.trim().length < 2) {
        return res.status(400).json({ error: 'NOM_INVALIDE', message: 'Nom requis (min 2 caractères)' });
    }
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'EMAIL_INVALIDE', message: 'Email invalide' });
    }
    if (!sujet || typeof sujet !== 'string' || sujet.trim().length < 5) {
        return res.status(400).json({ error: 'SUJET_INVALIDE', message: 'Sujet requis (min 5 caractères)' });
    }
    if (!message || typeof message !== 'string' || message.trim().length < 20) {
        return res.status(400).json({ error: 'MESSAGE_INVALIDE', message: 'Message requis (min 20 caractères)' });
    }

    // Log console détaillé
    console.log('═══════════════════════════════════════════');
    console.log('📧 NOUVEAU MESSAGE DE CONTACT');
    console.log('  De: ' + nom + ' (' + email + ')');
    console.log('  Entreprise: ' + (company || 'Non renseignée'));
    console.log('  Sujet: ' + sujet);
    console.log('  Message: ' + message);
    console.log('  Date: ' + new Date().toISOString());
    console.log('═══════════════════════════════════════════');

    // Vérification SMTP
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ SMTP non configuré — message enregistré uniquement en console');
        return res.json({ success: true, message: 'Message envoyé avec succès' });
    }

    // Envoi email en arrière-plan (non-bloquant pour l'utilisateur)
    (async () => {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
            });

            const emailTo = process.env.EMAIL_TO || process.env.EMAIL_USER;

            // Email à l'administrateur
            await transporter.sendMail({
                from: '"AuditAxis QSE" <' + process.env.EMAIL_USER + '>',
                replyTo: email,
                to: emailTo,
                subject: '[AuditAxis] ' + sujet,
                html: `<h2>Nouveau message de contact</h2>` +
                      `<p><b>Nom:</b> ${nom}</p>` +
                      `<p><b>Email:</b> ${email}</p>` +
                      (company ? `<p><b>Entreprise:</b> ${company}</p>` : '') +
                      `<p><b>Sujet:</b> ${sujet}</p>` +
                      `<p><b>Message:</b><br>${message.replace(/\n/g, '<br>')}</p>`,
            });

            // Email de confirmation à l'expéditeur
            await transporter.sendMail({
                from: '"AuditAxis QSE" <' + process.env.EMAIL_USER + '>',
                to: email,
                subject: 'Message reçu — AuditAxis QSE',
                html: `<h2>Merci, ${nom} !</h2>` +
                      `<p>Nous avons bien reçu votre message et reviendrons vers vous rapidement.</p>` +
                      `<p><b>Sujet :</b> ${sujet}</p>`,
            });

            console.log('✅ Emails envoyés avec succès');
        } catch (error) {
            console.error('❌ Erreur envoi email:', error.message);
        }
    })();

    // Réponse immédiate au frontend
    res.json({ success: true, message: 'Message envoyé avec succès' });
});

// ─────────────────────────────────────────────
// ROUTES DE SANTÉ ET INFOS
// ─────────────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        email: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    });
});

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

// ─────────────────────────────────────────────
// GESTION DES ERREURS (404 & Global)
// ─────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({ error: 'ROUTE_NON_TROUVEE', message: 'Route non trouvée', path: req.path });
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err);
    if (err.status === 401) return res.status(401).json({ error: 'AUTH_ERROR', message: 'Erreur auth IA' });
    if (err.status === 429) return res.status(429).json({ error: 'RATE_LIMIT', message: 'Trop de requêtes IA' });
    res.status(err.status || 500).json({ error: 'ERREUR_SERVEUR', message: 'Erreur interne' });
});

// ─────────────────────────────────────────────
// DÉMARRAGE DU SERVEUR
// ─────────────────────────────────────────────

app.listen(PORT, () => {
    console.log('🚀 Serveur AuditAxis QSE démarré sur le port ' + PORT);
    console.log('🔧 Environnement: ' + (process.env.NODE_ENV || 'development'));
    console.log('📧 SMTP: ' + (process.env.EMAIL_USER ? '✅ configuré' : '⚠️ non configuré'));
});

module.exports = app;
