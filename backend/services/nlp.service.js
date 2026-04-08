import pool from '../config/db.js';

const HI_TO_EN = {
    'भीड़': 'crowd', 'भीड': 'crowd',
    'लापता': 'missing', 'गुमशुदा': 'missing',
    'व्यक्ति': 'person', 'व्यक्‍ति': 'person',
    'अलर्ट': 'alert', 'चेतावनी': 'alert',
    'खतरा': 'danger', 'जोखिम': 'risk',
    'सुरक्षित': 'safe', 'खोजो': 'search',
    'कितने': 'how many', 'लोग': 'people',
    'स्थिति': 'status', 'रिपोर्ट': 'report',
    'वीडियो': 'video', 'आज': 'today',
    'मिला': 'found', 'मदद': 'help',
    'क्रिटिकल': 'critical', 'जरूरी': 'urgent',
    'पहचान': 'identify', 'चेहरा': 'face',
    'सूची': 'list', 'दिखाओ': 'show',
    'कुल': 'total', 'संख्या': 'count'
};

const MR_TO_EN = {
    'गर्दी': 'crowd',
    'हरवलेले': 'missing', 'हरवले': 'missing',
    'व्यक्ती': 'person', 'माणूस': 'person',
    'इशारा': 'alert', 'धोका': 'danger',
    'सुरक्षित': 'safe', 'शोध': 'search',
    'किती': 'how many', 'लोक': 'people',
    'स्थिती': 'status', 'अहवाल': 'report',
    'व्हिडिओ': 'video', 'आज': 'today',
    'सापडले': 'found', 'मदत': 'help',
    'गंभीर': 'critical', 'ओळख': 'identify',
    'चेहरा': 'face', 'यादी': 'list',
    'दाखवा': 'show', 'एकूण': 'total'
};

const INTENTS = {
    CROWD_STATUS: {
        keywords: ['crowd', 'density', 'risk', 'safe', 'people', 'how many', 'count', 'current', 'level', 'status', 'moderate', 'risky', 'critical', 'dangerous'],
        priority: 1
    },
    MISSING_PERSONS: {
        keywords: ['missing', 'lost', 'person', 'found', 'search', 'identify', 'face', 'match', 'register', 'active', 'who is', 'looking for'],
        priority: 1
    },
    ALERTS: {
        keywords: ['alert', 'warning', 'danger', 'emergency', 'notification', 'unread', 'acknowledge', 'ack', 'today alert', 'recent'],
        priority: 1
    },
    VIDEO_STATUS: {
        keywords: ['video', 'processing', 'upload', 'analysis', 'job', 'processed', 'footage', 'cctv', 'analyze'],
        priority: 1
    },
    STATISTICS: {
        keywords: ['total', 'statistics', 'stats', 'summary', 'report', 'today', 'overall', 'dashboard', 'how many videos', 'performance'],
        priority: 1
    },
    AUTOMATION_MARK_FOUND: {
        keywords: ['mark found', 'set found', 'mark as found', 'person found', 'was found', 'located'],
        priority: 2
    },
    AUTOMATION_ACK_ALERTS: {
        keywords: ['acknowledge all', 'ack all', 'clear alerts', 'dismiss alerts', 'mark read'],
        priority: 2
    },
    AUTOMATION_NAVIGATE: {
        keywords: ['go to', 'open', 'navigate', 'show page', 'take me to', 'dashboard', 'crowd page', 'missing page', 'alerts page'],
        priority: 2
    },
    HELP: {
        keywords: ['help', 'commands', 'what can', 'how to', 'guide', 'tutorial', 'options', 'features'],
        priority: 1
    }
};

const ALERT_TABLE_CANDIDATES = ['alerts', 'alert_logs'];
let cachedAlertTable = null;
let cachedAlertAcknowledgedColumn = null;

async function query(text, params = []) {
    return pool.query(text, params);
}

async function resolveAlertTable() {
    if (cachedAlertTable) return cachedAlertTable;
    for (const table of ALERT_TABLE_CANDIDATES) {
        const { rows } = await query(
            `SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            ) AS exists`,
            [table]
        );
        if (rows[0]?.exists) {
            cachedAlertTable = table;
            return cachedAlertTable;
        }
    }
    cachedAlertTable = 'alert_logs';
    return cachedAlertTable;
}

async function hasAlertAcknowledgedColumn() {
    if (cachedAlertAcknowledgedColumn !== null) return cachedAlertAcknowledgedColumn;
    const alertTable = await resolveAlertTable();
    const { rows } = await query(
        `SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
              AND column_name = 'acknowledged'
        ) AS exists`,
        [alertTable]
    );
    cachedAlertAcknowledgedColumn = rows[0]?.exists === true;
    return cachedAlertAcknowledgedColumn;
}

export function translateToEnglish(text, lang) {
    if (!text) return '';
    if (lang === 'en') return text.toLowerCase();
    const dict = lang === 'hi' ? HI_TO_EN : MR_TO_EN;
    let translated = text.toLowerCase();
    for (const [native, english] of Object.entries(dict)) {
        translated = translated.replace(new RegExp(native, 'gi'), english);
    }
    return translated;
}

export function detectIntent(text) {
    const lower = text.toLowerCase();
    let bestIntent = 'UNKNOWN';
    let bestScore = 0;
    let bestPriority = 0;

    for (const [intent, config] of Object.entries(INTENTS)) {
        let score = 0;
        for (const kw of config.keywords) {
            if (lower.includes(kw)) score += 1;
        }
        if (score > bestScore || (score === bestScore && config.priority > bestPriority)) {
            bestScore = score;
            bestIntent = intent;
            bestPriority = config.priority;
        }
    }
    return bestScore > 0 ? bestIntent : 'UNKNOWN';
}

async function handleCrowdStatus() {
    const result = await query(`
      SELECT filename,
             total_people::text as people,
             risk_level as risk,
             avg_density::text as avg,
             processing_completed_at as processed_at
      FROM video_jobs
      WHERE status = 'COMPLETED'
      ORDER BY processing_completed_at DESC NULLS LAST, uploaded_at DESC
      LIMIT 1
    `);

    if (result.rowCount === 0) {
        return {
            text: 'No videos have been processed yet. Upload a video on the Crowd Analysis page to get started.',
            intent: 'CROWD_STATUS',
            action: { type: 'navigate', path: '/crowd', label: 'Go to Crowd Analysis' }
        };
    }

    const job = result.rows[0];
    const risk = (job.risk || 'UNKNOWN').toUpperCase();
    const riskEmoji = { SAFE: '🟢', MODERATE: '🟡', RISKY: '🟠', CRITICAL: '🔴' }[risk] || '⚪';
    const avg = Number.parseFloat(job.avg || '0');

    return {
        text: `Latest analysis: ${riskEmoji} ${risk} risk level\n` +
            `📹 Video: ${job.filename}\n` +
            `👥 Peak count: ${job.people || 0} people\n` +
            `📊 Avg per frame: ${Number.isFinite(avg) ? avg.toFixed(1) : '0.0'}\n` +
            `🕐 Processed: ${job.processed_at ? new Date(job.processed_at).toLocaleString() : 'N/A'}`,
        intent: 'CROWD_STATUS',
        data: job,
        action: risk === 'CRITICAL' || risk === 'RISKY'
            ? { type: 'navigate', path: '/alerts', label: 'View Alerts' }
            : null
    };
}

async function handleMissingPersons() {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
        COUNT(*) FILTER (WHERE status = 'FOUND') as found,
        COUNT(*) FILTER (WHERE status = 'POSSIBLE_MATCH') as possible
      FROM missing_persons
      WHERE status != 'INACTIVE'
    `);

    const recent = await query(`
      SELECT name, last_seen_location, status, reported_date
      FROM missing_persons
      WHERE status = 'ACTIVE'
      ORDER BY reported_date DESC
      LIMIT 3
    `);

    const counts = result.rows[0];
    let text = `Missing persons status:\n` +
      `🔴 Active: ${counts.active}\n` +
      `🟡 Possible matches: ${counts.possible}\n` +
      `🟢 Found: ${counts.found}`;

    if (recent.rowCount > 0) {
        text += '\n\nRecent active cases:';
        recent.rows.forEach((p) => {
            text += `\n• ${p.name} — last seen at ${p.last_seen_location || 'unknown location'}`;
        });
    }

    return {
        text,
        intent: 'MISSING_PERSONS',
        action: { type: 'navigate', path: '/missing-persons', label: 'View All Missing Persons' }
    };
}

async function handleAlerts() {
    const table = await resolveAlertTable();
    const hasAck = await hasAlertAcknowledgedColumn();
    const queryText = hasAck
        ? `
            SELECT
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE risk_level = 'CRITICAL') as critical,
              COUNT(*) FILTER (WHERE risk_level = 'RISKY') as risky,
              COUNT(*) FILTER (WHERE acknowledged = false) as unread
            FROM ${table}
            WHERE created_at > NOW() - INTERVAL '24 hours'
          `
        : `
            SELECT
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE risk_level = 'CRITICAL') as critical,
              COUNT(*) FILTER (WHERE risk_level = 'RISKY') as risky,
              COUNT(*) as unread
            FROM ${table}
            WHERE created_at > NOW() - INTERVAL '24 hours'
          `;
    const result = await query(queryText);
    const counts = result.rows[0];

    return {
        text: `Alerts in the last 24 hours:\n` +
            `📊 Total: ${counts.total}\n` +
            `🔴 Critical: ${counts.critical}\n` +
            `🟠 Risky: ${counts.risky}\n` +
            `🔔 Unread: ${counts.unread}`,
        intent: 'ALERTS',
        action: Number.parseInt(counts.unread, 10) > 0
            ? { type: 'navigate', path: '/alerts', label: `View ${counts.unread} Unread Alerts` }
            : null
    };
}

async function handleVideoStatus() {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE status = 'PROCESSING' OR status = 'QUEUED') as processing,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
        COUNT(*) FILTER (WHERE uploaded_at > NOW() - INTERVAL '24 hours') as today
      FROM video_jobs
    `);
    const counts = result.rows[0];

    return {
        text: `Video processing status:\n` +
            `📹 Today: ${counts.today} videos\n` +
            `✅ Completed: ${counts.completed}\n` +
            `⚙️ Processing: ${counts.processing}\n` +
            `❌ Failed: ${counts.failed}\n` +
            `📁 Total all time: ${counts.total}`,
        intent: 'VIDEO_STATUS',
        action: Number.parseInt(counts.processing, 10) > 0
            ? { type: 'navigate', path: '/crowd', label: 'View Active Processing' }
            : { type: 'navigate', path: '/crowd', label: 'Upload New Video' }
    };
}

async function handleStatistics() {
    const table = await resolveAlertTable();
    const hasAck = await hasAlertAcknowledgedColumn();
    const [jobs, persons, alerts] = await Promise.all([
        query(`SELECT
               COUNT(*) FILTER (WHERE status='COMPLETED') as videos,
               COALESCE(SUM(total_people) FILTER (WHERE status='COMPLETED'), 0) as people
             FROM video_jobs`),
        query(`SELECT
               COUNT(*) FILTER (WHERE status='ACTIVE') as active,
               COUNT(*) FILTER (WHERE status='FOUND') as found
             FROM missing_persons`),
        query(hasAck
            ? `SELECT COUNT(*) FILTER (WHERE acknowledged=false) as unread FROM ${table}`
            : `SELECT COUNT(*) as unread FROM ${table}`)
    ]);

    return {
        text: `System summary:\n` +
            `🎬 Videos processed: ${jobs.rows[0].videos}\n` +
            `👥 Total people detected: ${jobs.rows[0].people}\n` +
            `🔍 Active missing persons: ${persons.rows[0].active}\n` +
            `✅ Persons found: ${persons.rows[0].found}\n` +
            `🔔 Unread alerts: ${alerts.rows[0].unread}`,
        intent: 'STATISTICS',
        action: { type: 'navigate', path: '/dashboard', label: 'View Dashboard' }
    };
}

async function handleAutomationMarkFound(message) {
    const nameMatch = message.match(/mark\s+(.+?)\s+(as\s+)?found/i);
    if (!nameMatch) {
        return {
            text: "Please specify the person's name. Example: 'mark John Doe as found'",
            intent: 'AUTOMATION_MARK_FOUND'
        };
    }

    const name = nameMatch[1].trim();
    const result = await query(
        `UPDATE missing_persons
         SET status = 'FOUND', updated_at = NOW(), found_timestamp = COALESCE(found_timestamp, NOW())
         WHERE LOWER(name) LIKE LOWER($1)
           AND status IN ('ACTIVE', 'POSSIBLE_MATCH')
         RETURNING id, name`,
        [`%${name}%`]
    );

    if (result.rowCount === 0) {
        return {
            text: `No active missing person found matching "${name}". Check the Missing Persons page for exact names.`,
            intent: 'AUTOMATION_MARK_FOUND',
            action: { type: 'navigate', path: '/missing-persons', label: 'View Missing Persons' }
        };
    }

    return {
        text: `✅ Marked ${result.rows[0].name} as FOUND. Database updated.`,
        intent: 'AUTOMATION_MARK_FOUND',
        data: result.rows[0]
    };
}

async function handleAutomationAckAlerts() {
    const table = await resolveAlertTable();
    const hasAck = await hasAlertAcknowledgedColumn();
    if (!hasAck) {
        return {
            text: 'Your current alerts schema does not support acknowledgement yet.',
            intent: 'AUTOMATION_ACK_ALERTS'
        };
    }

    const result = await query(`
      UPDATE ${table}
      SET acknowledged = true,
          acknowledged_by = COALESCE(acknowledged_by, 'chatbot'),
          acknowledged_at = NOW()
      WHERE acknowledged = false
      RETURNING id
    `);

    return {
        text: `✅ Acknowledged ${result.rowCount} alert${result.rowCount !== 1 ? 's' : ''}.`,
        intent: 'AUTOMATION_ACK_ALERTS'
    };
}

function handleNavigation(message) {
    const routes = {
        dashboard: '/dashboard',
        crowd: '/crowd',
        'crowd analysis': '/crowd',
        missing: '/missing-persons',
        'missing persons': '/missing-persons',
        alerts: '/alerts',
        map: '/map',
        settings: '/settings'
    };

    const lower = message.toLowerCase();
    for (const [keyword, path] of Object.entries(routes)) {
        if (lower.includes(keyword)) {
            return {
                text: `Opening ${keyword} page...`,
                intent: 'AUTOMATION_NAVIGATE',
                action: { type: 'navigate', path, label: `Go to ${keyword}`, autoExecute: true }
            };
        }
    }

    return {
        text: "Available pages: Dashboard, Crowd Analysis, Missing Persons, Alerts, Map, Settings. Say 'go to [page name]'.",
        intent: 'AUTOMATION_NAVIGATE'
    };
}

function handleHelp(lang) {
    const commands = {
        en: [
            "📊 'crowd status' — current risk level and people count",
            "👥 'missing persons' — active cases and recent entries",
            "🔔 'alerts' — alert summary for last 24 hours",
            "🎬 'video status' — processing jobs summary",
            "📈 'statistics' — full system overview",
            "✅ 'mark [name] as found' — update person status",
            "🔕 'acknowledge all alerts' — clear unread alerts",
            "🧭 'go to [page]' — navigate to any page",
            '🎤 Use the mic button to speak your query'
        ],
        hi: [
            "📊 'भीड़ की स्थिति' — वर्तमान जोखिम स्तर",
            "👥 'लापता व्यक्ति' — सक्रिय मामले",
            "🔔 'अलर्ट' — पिछले 24 घंटे के अलर्ट",
            "✅ '[नाम] मिला' — व्यक्ति की स्थिति अपडेट करें"
        ],
        mr: [
            "📊 'गर्दीची स्थिती' — सध्याचा धोका स्तर",
            "👥 'हरवलेले व्यक्ती' — सक्रिय प्रकरणे",
            "🔔 'इशारे' — गेल्या 24 तासांचे इशारे",
            "✅ '[नाव] सापडले' — व्यक्तीची स्थिती अपडेट करा"
        ]
    };

    const list = commands[lang] || commands.en;
    return {
        text: "Here's what I can help you with:\n\n" + list.join('\n'),
        intent: 'HELP'
    };
}

export async function processMessage(message, lang = 'en') {
    try {
        const translated = translateToEnglish(message, lang);
        const intent = detectIntent(translated);

        switch (intent) {
            case 'CROWD_STATUS': return await handleCrowdStatus();
            case 'MISSING_PERSONS': return await handleMissingPersons();
            case 'ALERTS': return await handleAlerts();
            case 'VIDEO_STATUS': return await handleVideoStatus();
            case 'STATISTICS': return await handleStatistics();
            case 'AUTOMATION_MARK_FOUND': return await handleAutomationMarkFound(translated);
            case 'AUTOMATION_ACK_ALERTS': return await handleAutomationAckAlerts();
            case 'AUTOMATION_NAVIGATE': return handleNavigation(translated);
            case 'HELP': return handleHelp(lang);
            default:
                return {
                    text: lang === 'hi'
                        ? "मैं यह समझ नहीं सका। 'मदद' टाइप करें उपलब्ध कमांड देखने के लिए।"
                        : lang === 'mr'
                            ? "मला हे समजले नाही। उपलब्ध कमांड पाहण्यासाठी 'मदत' टाइप करा."
                            : "I didn't understand that. Type 'help' to see available commands.",
                    intent: 'UNKNOWN',
                    action: null
                };
        }
    } catch (err) {
        console.error('NLP error:', err);
        return {
            text: 'Sorry, I encountered an error processing your request. Please try again.',
            intent: 'ERROR'
        };
    }
}
