const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pollyany2026';
const JWT_SECRET = process.env.JWT_SECRET || 'clinica_pollyany_secret_2026';

// Certificar diretório de dados
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inicializar SQLite nativo
const dbPath = path.join(dataDir, 'analytics.db');
const db = new DatabaseSync(dbPath);

// Configurar modo WAL e performance
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    page_path TEXT NOT NULL,
    page_category TEXT NOT NULL,
    target_text TEXT,
    target_id TEXT,
    target_url TEXT,
    target_local TEXT,
    duration_seconds REAL DEFAULT 0,
    video_milestone INTEGER DEFAULT 0,
    video_name TEXT,
    device TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_at TEXT NOT NULL,
    created_date TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_events_date ON events(created_date);
  CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name);
  CREATE INDEX IF NOT EXISTS idx_events_page ON events(page_category);
  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(visitor_id);
`);

// Migração segura para adicionar coluna button_type se não existir
try {
  db.exec(`ALTER TABLE events ADD COLUMN button_type TEXT;`);
} catch (e) {}

// Prepara declaração de inserção
const insertStmt = db.prepare(`
  INSERT INTO events (
    visitor_id, session_id, event_name, page_path, page_category,
    target_text, target_id, target_url, target_local, button_type,
    duration_seconds, video_milestone, video_name,
    device, referrer, utm_source, utm_medium, utm_campaign,
    created_at, created_date
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?
  )
`);

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Suporte para application/json e text/plain (usado pelo sendBeacon)
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: 'text/plain', limit: '1mb' }));

// Helper de Autenticação Simples por Token HMAC
function generateToken() {
  const payload = `admin:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

function verifyToken(token) {
  if (!token) return false;
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const [user, ts, hmac] = raw.split(':');
    if (user !== 'admin') return false;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${user}:${ts}`).digest('hex');
    if (expected !== hmac) return false;
    // Expira em 7 dias
    const tokenTime = parseInt(ts, 10);
    if (Date.now() - tokenTime > 7 * 24 * 60 * 60 * 1000) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────
// ENDPOINT 1: INGESTÃO DE EVENTOS (/api/collect)
// ─────────────────────────────────────────────────────────────
app.post('/api/collect', (req, res) => {
  let payload = req.body;
  
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      return res.status(400).send('Invalid JSON');
    }
  }

  if (!payload) {
    return res.status(400).send('Missing body');
  }

  const events = Array.isArray(payload) ? payload : [payload];
  const now = new Date();
  const defaultIso = now.toISOString();
  const defaultDate = defaultIso.slice(0, 10);

  for (const ev of events) {
    if (!ev || !ev.event_name) continue;

    const visitorId = (ev.visitor_id || 'anonymous').slice(0, 64);
    const sessionId = (ev.session_id || 'unknown').slice(0, 64);
    const eventName = ev.event_name.slice(0, 64);
    const pagePath = (ev.page_path || '/').slice(0, 255);
    
    // Categorizar a página
    let pageCategory = ev.page_category;
    if (!pageCategory) {
      if (pagePath.includes('/implante')) pageCategory = 'implante';
      else if (pagePath.includes('/preenchimento-labial') || pagePath.includes('/preenchimento')) pageCategory = 'preenchimento';
      else if (pagePath.includes('/alinhador')) pageCategory = 'alinhador';
      else if (pagePath.includes('/equipe/')) pageCategory = 'equipe';
      else pageCategory = 'principal';
    }

    const targetText = (ev.target_text || '').slice(0, 200);
    const targetId = (ev.target_id || '').slice(0, 100);
    const targetUrl = (ev.target_url || '').slice(0, 500);
    const targetLocal = (ev.target_local || '').slice(0, 100);
    const buttonType = (ev.button_type || '').slice(0, 50);
    const durationSeconds = typeof ev.duration_seconds === 'number' ? ev.duration_seconds : 0;
    const videoMilestone = typeof ev.video_milestone === 'number' ? ev.video_milestone : 0;
    const videoName = (ev.video_name || '').slice(0, 100);
    const device = (ev.device || 'desktop').slice(0, 32);
    const referrer = (ev.referrer || '').slice(0, 500);
    const utmSource = (ev.utm_source || '').slice(0, 100);
    const utmMedium = (ev.utm_medium || '').slice(0, 100);
    const utmCampaign = (ev.utm_campaign || '').slice(0, 100);
    const createdAt = ev.created_at || defaultIso;
    const createdDate = createdAt.slice(0, 10) || defaultDate;

    try {
      insertStmt.run(
        visitorId, sessionId, eventName, pagePath, pageCategory,
        targetText, targetId, targetUrl, targetLocal, buttonType,
        durationSeconds, videoMilestone, videoName,
        device, referrer, utmSource, utmMedium, utmCampaign,
        createdAt, createdDate
      );
    } catch (err) {
      console.error('[Collect Insert Error]', err);
    }
  }

  res.status(204).end();
});

// ─────────────────────────────────────────────────────────────
// ENDPOINT 2: AUTENTICAÇÃO
// ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    const token = generateToken();
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, error: 'Senha incorreta' });
});

app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (verifyToken(token)) {
    return res.json({ valid: true });
  }
  return res.status(401).json({ valid: false });
});

// Helper de query com filtro de data e página
function buildFilterClause(req) {
  const { startDate, endDate, page } = req.query;
  const conditions = [];
  const params = [];

  if (startDate) {
    conditions.push('created_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('created_date <= ?');
    params.push(endDate);
  }
  if (page && page !== 'todas') {
    conditions.push('page_category = ?');
    params.push(page);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// ─────────────────────────────────────────────────────────────
// ENDPOINT 3: VISÃO GERAL / KPIS (/api/stats/overview)
// ─────────────────────────────────────────────────────────────
app.get('/api/stats/overview', authMiddleware, (req, res) => {
  const { where, params } = buildFilterClause(req);

  // Visitantes únicos e Pageviews
  const totalVisitorsStmt = db.prepare(`
    SELECT 
      COUNT(DISTINCT visitor_id) AS visitors,
      COUNT(CASE WHEN event_name = 'page_view' THEN 1 END) AS pageviews,
      COUNT(CASE WHEN event_name LIKE 'clique_%' THEN 1 END) AS clicks
    FROM events ${where}
  `);
  const general = totalVisitorsStmt.get(...params) || { visitors: 0, pageviews: 0, clicks: 0 };

  // Contagem por Canais Específicos
  const channelsStmt = db.prepare(`
    SELECT 
      COUNT(CASE WHEN event_name = 'clique_whatsapp' OR target_url LIKE '%wa.me%' OR target_url LIKE '%whatsapp%' OR button_type = 'WhatsApp' THEN 1 END) AS whatsapp,
      COUNT(CASE WHEN event_name = 'clique_instagram' OR target_url LIKE '%instagram.com%' OR button_type = 'Instagram' THEN 1 END) AS instagram,
      COUNT(CASE WHEN event_name IN ('clique_google_negocio', 'clique_avaliacao', 'clique_localizacao') OR target_url LIKE '%g.page%' OR target_url LIKE '%share.google%' OR target_url LIKE '%google.com/maps%' OR button_type = 'Google Meu Negócio' THEN 1 END) AS google,
      COUNT(CASE WHEN event_name = 'clique_agendamento' OR target_url LIKE '%agenda.link%' OR button_type = 'Agendamento Online' THEN 1 END) AS agendamento
    FROM events ${where ? where + " AND event_name LIKE 'clique_%'" : "WHERE event_name LIKE 'clique_%'"}
  `);
  const channels = channelsStmt.get(...params) || { whatsapp: 0, instagram: 0, google: 0, agendamento: 0 };

  // Tempo médio na página (por sessão)
  const timeStmt = db.prepare(`
    SELECT AVG(max_duration) as avg_duration FROM (
      SELECT session_id, MAX(duration_seconds) as max_duration 
      FROM events 
      ${where ? where + " AND duration_seconds > 0" : "WHERE duration_seconds > 0"}
      GROUP BY session_id
    )
  `);
  const timeRes = timeStmt.get(...params) || { avg_duration: 0 };

  // Vídeos: plays e conclusões
  const videoStmt = db.prepare(`
    SELECT 
      COUNT(CASE WHEN event_name = 'video_play' THEN 1 END) as plays,
      COUNT(CASE WHEN event_name = 'video_completo' OR video_milestone = 100 THEN 1 END) as completions
    FROM events ${where}
  `);
  const videoRes = videoStmt.get(...params) || { plays: 0, completions: 0 };

  const visitors = general.visitors || 0;
  const pageviews = general.pageviews || 0;
  const clicks = general.clicks || 0;
  const avgDuration = Math.round(timeRes.avg_duration || 0);
  const videoPlays = videoRes.plays || 0;
  const videoCompletions = videoRes.completions || 0;
  const videoCompletionRate = videoPlays > 0 ? Math.round((videoCompletions / videoPlays) * 100) : 0;
  const ctrGlobal = visitors > 0 ? ((clicks / visitors) * 100).toFixed(1) : '0.0';

  res.json({
    visitors,
    pageviews,
    clicks,
    whatsappClicks: channels.whatsapp || 0,
    instagramClicks: channels.instagram || 0,
    googleClicks: channels.google || 0,
    agendamentoClicks: channels.agendamento || 0,
    avgDuration,
    videoPlays,
    videoCompletions,
    videoCompletionRate,
    ctrGlobal
  });
});

// ─────────────────────────────────────────────────────────────
// ENDPOINT 4: MÉTRICAS POR PÁGINA (/api/stats/pages)
// ─────────────────────────────────────────────────────────────
app.get('/api/stats/pages', authMiddleware, (req, res) => {
  const { where, params } = buildFilterClause(req);

  const stmt = db.prepare(`
    SELECT 
      page_category,
      COUNT(DISTINCT visitor_id) as visitors,
      COUNT(CASE WHEN event_name = 'page_view' THEN 1 END) as pageviews,
      COUNT(CASE WHEN event_name LIKE 'clique_%' THEN 1 END) as clicks,
      ROUND(AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds END)) as avg_time
    FROM events
    ${where}
    GROUP BY page_category
    ORDER BY visitors DESC
  `);
  const rows = stmt.all(...params);

  const pagesMap = {
    'principal': 'Página Principal (Árvore)',
    'implante': 'Landing Page Implantes',
    'preenchimento': 'Landing Page Preenchimento Labial',
    'alinhador': 'Landing Page Alinhadores',
    'equipe': 'Perfis da Equipe Médica'
  };

  const formatted = rows.map(r => ({
    category: r.page_category,
    name: pagesMap[r.page_category] || r.page_category,
    visitors: r.visitors || 0,
    pageviews: r.pageviews || 0,
    clicks: r.clicks || 0,
    avgTime: r.avg_time || 0,
    ctr: r.visitors > 0 ? ((r.clicks / r.visitors) * 100).toFixed(1) : '0.0'
  }));

  res.json(formatted);
});

// ─────────────────────────────────────────────────────────────
// ENDPOINT 5: ANÁLISE DE BOTÕES COM CANAIS (/api/stats/buttons)
// ─────────────────────────────────────────────────────────────
app.get('/api/stats/buttons', authMiddleware, (req, res) => {
  const { where, params } = buildFilterClause(req);
  const clickWhere = where ? `${where} AND event_name LIKE 'clique_%'` : "WHERE event_name LIKE 'clique_%'";

  // Ranking com classificação de canal
  const rankingStmt = db.prepare(`
    SELECT 
      target_text,
      target_id,
      target_local,
      page_category,
      CASE 
        WHEN button_type IS NOT NULL AND button_type != '' AND button_type != 'outro' THEN button_type
        WHEN event_name = 'clique_whatsapp' OR target_url LIKE '%wa.me%' OR target_url LIKE '%whatsapp%' THEN 'WhatsApp'
        WHEN event_name = 'clique_instagram' OR target_url LIKE '%instagram.com%' OR target_local LIKE '%instagram%' THEN 'Instagram'
        WHEN event_name IN ('clique_google_negocio', 'clique_avaliacao', 'clique_localizacao') OR target_url LIKE '%g.page%' OR target_url LIKE '%share.google%' OR target_url LIKE '%google.com/maps%' THEN 'Google Meu Negócio'
        WHEN event_name = 'clique_agendamento' OR target_url LIKE '%agenda.link%' THEN 'Agendamento Online'
        WHEN event_name = 'clique_facebook' OR target_url LIKE '%facebook.com%' THEN 'Facebook'
        WHEN event_name = 'clique_doutor' OR target_url LIKE '%equipe/%' THEN 'Doutores'
        WHEN event_name = 'clique_especialidade' OR target_url LIKE '%implante%' OR target_url LIKE '%preenchimento%' OR target_url LIKE '%alinhador%' THEN 'Especialidades'
        ELSE 'Outro'
      END AS channel,
      COUNT(*) as total_clicks,
      COUNT(DISTINCT visitor_id) as unique_clickers
    FROM events
    ${clickWhere}
    GROUP BY target_text, target_id, target_local, page_category, channel
    ORDER BY total_clicks DESC
  `);
  let buttons = rankingStmt.all(...params);

  // Filtro opcional por canal (ex: whatsapp, instagram, google, agendamento)
  const channelFilter = req.query.channel;
  if (channelFilter && channelFilter !== 'todos') {
    buttons = buttons.filter(b => b.channel.toLowerCase().includes(channelFilter.toLowerCase()));
  }

  // Evolução diária por botão
  const dailyStmt = db.prepare(`
    SELECT 
      created_date,
      target_text,
      COUNT(*) as clicks
    FROM events
    ${clickWhere}
    GROUP BY created_date, target_text
    ORDER BY created_date ASC
  `);
  const dailyBreakdown = dailyStmt.all(...params);

  // Resumo por canais
  const summaryStmt = db.prepare(`
    SELECT 
      COUNT(CASE WHEN event_name = 'clique_whatsapp' OR target_url LIKE '%wa.me%' OR target_url LIKE '%whatsapp%' OR button_type = 'WhatsApp' THEN 1 END) AS whatsapp,
      COUNT(CASE WHEN event_name = 'clique_instagram' OR target_url LIKE '%instagram.com%' OR button_type = 'Instagram' THEN 1 END) AS instagram,
      COUNT(CASE WHEN event_name IN ('clique_google_negocio', 'clique_avaliacao', 'clique_localizacao') OR target_url LIKE '%g.page%' OR target_url LIKE '%share.google%' OR target_url LIKE '%google.com/maps%' OR button_type = 'Google Meu Negócio' THEN 1 END) AS google,
      COUNT(CASE WHEN event_name = 'clique_agendamento' OR target_url LIKE '%agenda.link%' OR button_type = 'Agendamento Online' THEN 1 END) AS agendamento,
      COUNT(*) as total
    FROM events
    ${clickWhere}
  `);
  const summary = summaryStmt.get(...params) || { whatsapp: 0, instagram: 0, google: 0, agendamento: 0, total: 0 };

  res.json({
    summary,
    buttons,
    dailyBreakdown
  });
});

// ─────────────────────────────────────────────────────────────
// ENDPOINT 6: ANÁLISE DETALHADA DE VÍDEOS (/api/stats/videos)
// ─────────────────────────────────────────────────────────────
app.get('/api/stats/videos', authMiddleware, (req, res) => {
  const { where, params } = buildFilterClause(req);

  // Funil de marcos de vídeo
  const funnelStmt = db.prepare(`
    SELECT 
      COUNT(CASE WHEN event_name = 'video_play' THEN 1 END) as plays,
      COUNT(CASE WHEN event_name = 'video_25' OR video_milestone = 25 THEN 1 END) as m25,
      COUNT(CASE WHEN event_name = 'video_50' OR video_milestone = 50 THEN 1 END) as m50,
      COUNT(CASE WHEN event_name = 'video_75' OR video_milestone = 75 THEN 1 END) as m75,
      COUNT(CASE WHEN event_name = 'video_completo' OR video_milestone = 100 THEN 1 END) as completed
    FROM events
    ${where}
  `);
  const funnel = funnelStmt.get(...params) || { plays: 0, m25: 0, m50: 0, m75: 0, completed: 0 };

  // Tempo médio assistido
  const durationStmt = db.prepare(`
    SELECT AVG(duration_seconds) as avg_duration 
    FROM events 
    ${where ? where + " AND (event_name LIKE 'video_%' OR video_name != '') AND duration_seconds > 0" : "WHERE (event_name LIKE 'video_%' OR video_name != '') AND duration_seconds > 0"}
  `);
  const durationRes = durationStmt.get(...params) || { avg_duration: 0 };

  // Cruzamento de Conversão:
  // Visitantes que assistiram 100% vs que clicaram no CTA
  const crossStmt = db.prepare(`
    WITH CompletedVisitors AS (
      SELECT DISTINCT visitor_id 
      FROM events 
      ${where ? where + " AND (event_name = 'video_completo' OR video_milestone = 100)" : "WHERE (event_name = 'video_completo' OR video_milestone = 100)"}
    ),
    Clickers AS (
      SELECT DISTINCT visitor_id 
      FROM events 
      ${where ? where + " AND event_name LIKE 'clique_%'" : "WHERE event_name LIKE 'clique_%'"}
    ),
    AllVideoVisitors AS (
      SELECT DISTINCT visitor_id 
      FROM events 
      ${where ? where + " AND event_name = 'video_play'" : "WHERE event_name = 'video_play'"}
    )
    SELECT 
      (SELECT COUNT(*) FROM CompletedVisitors) as total_completed,
      (SELECT COUNT(*) FROM CompletedVisitors WHERE visitor_id IN (SELECT visitor_id FROM Clickers)) as completed_and_clicked,
      (SELECT COUNT(*) FROM AllVideoVisitors WHERE visitor_id NOT IN (SELECT visitor_id FROM CompletedVisitors)) as total_dropped,
      (SELECT COUNT(*) FROM AllVideoVisitors WHERE visitor_id NOT IN (SELECT visitor_id FROM CompletedVisitors) AND visitor_id IN (SELECT visitor_id FROM Clickers)) as dropped_and_clicked
  `);
  const crossRes = crossStmt.get(...params) || { total_completed: 0, completed_and_clicked: 0, total_dropped: 0, dropped_and_clicked: 0 };

  res.json({
    funnel,
    avgWatchTime: Math.round(durationRes.avg_duration || 0),
    crossConversion: {
      completedTotal: crossRes.total_completed || 0,
      completedClicked: crossRes.completed_and_clicked || 0,
      completedRate: crossRes.total_completed > 0 ? ((crossRes.completed_and_clicked / crossRes.total_completed) * 100).toFixed(1) : '0.0',
      droppedTotal: crossRes.total_dropped || 0,
      droppedClicked: crossRes.dropped_and_clicked || 0,
      droppedRate: crossRes.total_dropped > 0 ? ((crossRes.dropped_and_clicked / crossRes.total_dropped) * 100).toFixed(1) : '0.0'
    }
  });
});

// ─────────────────────────────────────────────────────────────
// ENDPOINT 7: LINHA DO TEMPO DIÁRIA (/api/stats/timeline)
// ─────────────────────────────────────────────────────────────
app.get('/api/stats/timeline', authMiddleware, (req, res) => {
  const { where, params } = buildFilterClause(req);

  const stmt = db.prepare(`
    SELECT 
      created_date,
      COUNT(DISTINCT visitor_id) as visitors,
      COUNT(CASE WHEN event_name = 'page_view' THEN 1 END) as pageviews,
      COUNT(CASE WHEN event_name LIKE 'clique_%' THEN 1 END) as clicks,
      COUNT(CASE WHEN event_name = 'video_play' THEN 1 END) as video_plays
    FROM events
    ${where}
    GROUP BY created_date
    ORDER BY created_date ASC
  `);
  const rows = stmt.all(...params);
  res.json(rows);
});

// Servir frontend estático do dashboard
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Clinica Analytics] Rodando na porta ${PORT}`);
});
