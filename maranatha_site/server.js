// Load .env file for local development (ignored if not present — Render injects env vars directly)
try { require('dotenv').config(); } catch (_) {}

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDirectory = path.join(__dirname, 'public');

// --- Cloudinary Configuration ---
// When CLOUDINARY_URL or all three individual vars are set, use Cloudinary.
// Otherwise fall back to local disk storage (useful for local dev without credentials).
const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('✅ Cloudinary storage enabled');
} else {
  console.log('⚠️  Cloudinary not configured — using local disk storage');
  // Ensure local upload directory exists for fallback
  const uploadDirectory = path.join(publicDirectory, 'uploads', 'audio');
  if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
  }
}

// --- Multer Storage: Cloudinary (production) or Disk (local dev) ---
let audioStorage;
if (useCloudinary) {
  audioStorage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => {
      const isLrc = path.extname(file.originalname).toLowerCase() === '.lrc' ||
                    file.mimetype === 'text/plain';
      return {
        folder: 'cm_portal/audio',
        resource_type: isLrc ? 'raw' : 'video', // Cloudinary uses 'video' for audio files
        public_id: `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        format: isLrc ? 'lrc' : undefined
      };
    }
  });
} else {
  const uploadDirectory = path.join(publicDirectory, 'uploads', 'audio');
  audioStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDirectory),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
      const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32);
      const unique = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      cb(null, `${safeBase}-${unique}${ext}`);
    }
  });
}

const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm', '.lrc', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || (file.mimetype && file.mimetype.startsWith('audio/')) || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only audio tracks (.mp3, .wav, .ogg, .m4a, .aac) and lyric files (.lrc, .txt) are permitted'));
    }
  }
});

// Helper: get the final URL for an uploaded file
// Cloudinary gives req.files[x][0].path; local disk gives a relative path we build.
function getUploadedFileUrl(fileObj) {
  if (useCloudinary) {
    return fileObj.path; // CloudinaryStorage sets .path to the secure Cloudinary URL
  }
  return `/uploads/audio/${fileObj.filename}`;
}

function handleSongUpload(req, res, next) {
  uploadAudio.fields([
    { name: 'vocal', maxCount: 1 },
    { name: 'instrumental', maxCount: 1 },
    { name: 'lrc_file', maxCount: 1 }
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return sendError(res, `Upload error: ${err.message}`, 400);
    } else if (err) {
      return sendError(res, err.message, 400);
    }
    next();
  });
}

// --- Default Seed Hymns ---
const defaultSongs = [
  {
    id: 1,
    title: 'Jesus Loves Me',
    vocal_audio_url: '',
    instrumental_audio_url: '',
    lyrics: `[00:00.00] Jesus loves me! This I know,
[00:04.50] For the Bible tells me so;
[00:09.00] Little ones to Him belong;
[00:13.50] They are weak, but He is strong.

[00:18.00] (Chorus)
[00:20.00] Yes, Jesus loves me!
[00:24.50] Yes, Jesus loves me!
[00:29.00] Yes, Jesus loves me!
[00:33.50] The Bible tells me so.

[00:39.00] Jesus loves me! He who died
[00:43.50] Heaven's gate to open wide;
[00:48.00] He will wash away my sin,
[00:52.50] Let His little child come in.

[00:58.00] (Chorus)
[01:00.00] Yes, Jesus loves me!
[01:04.50] Yes, Jesus loves me!
[01:09.00] Yes, Jesus loves me!
[01:13.50] The Bible tells me so.`,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    title: 'This Little Light of Mine',
    vocal_audio_url: '',
    instrumental_audio_url: '',
    lyrics: `[00:00.00] This little light of mine, I'm gonna let it shine!
[00:05.00] This little light of mine, I'm gonna let it shine!
[00:10.00] This little light of mine, I'm gonna let it shine!
[00:15.00] Let it shine, let it shine, let it shine!

[00:21.00] Hide it under a bushel? No! I'm gonna let it shine!
[00:26.00] Hide it under a bushel? No! I'm gonna let it shine!
[00:31.00] Hide it under a bushel? No! I'm gonna let it shine!
[00:36.00] Let it shine, let it shine, let it shine!

[00:42.00] Won't let Satan blow it out, I'm gonna let it shine!
[00:47.00] Won't let Satan blow it out, I'm gonna let it shine!
[00:52.00] Won't let Satan blow it out, I'm gonna let it shine!
[00:57.00] Let it shine, let it shine, let it shine!`,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    title: 'Father Abraham',
    vocal_audio_url: '',
    instrumental_audio_url: '',
    lyrics: `[00:00.00] Father Abraham had many sons
[00:04.50] Many sons had Father Abraham
[00:09.00] I am one of them, and so are you
[00:13.50] So let's all praise the Lord!
[00:17.00] Right arm!

[00:20.00] Father Abraham had many sons
[00:24.50] Many sons had Father Abraham
[00:29.00] I am one of them, and so are you
[00:33.50] So let's all praise the Lord!
[00:37.00] Right arm, left arm!

[00:41.00] Father Abraham had many sons
[00:45.50] Many sons had Father Abraham
[00:50.00] I am one of them, and so are you
[00:54.50] So let's all praise the Lord!
[00:58.00] Right arm, left arm, right foot!`,
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    title: "I've Got the Joy, Joy, Joy",
    vocal_audio_url: '',
    instrumental_audio_url: '',
    lyrics: `[00:00.00] I've got the joy, joy, joy, joy down in my heart!
[00:05.00] Where? Down in my heart!
[00:08.00] Where? Down in my heart!
[00:10.50] I've got the joy, joy, joy, joy down in my heart!
[00:15.50] Down in my heart to stay!

[00:20.00] And I'm so happy, so very happy!
[00:25.00] I've got the love of Jesus in my heart!
[00:30.00] And I'm so happy, so very happy!
[00:35.00] I've got the love of Jesus in my heart!`,
    created_at: new Date().toISOString()
  }
];

let fallbackSongs = [...defaultSongs];

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cm_portal',
  ssl: (process.env.DB_SSL === 'true' || (process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') && !process.env.DB_HOST.includes('127.0.0.1')))
    ? { rejectUnauthorized: false }
    : undefined
};
const sessions = new Map();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- HTML route guards ---
app.get('/admin.html', (req, res, next) => {
  if (!sessionUser(req)?.isAdmin) return res.redirect('/login.html');
  next();
});
app.get('/user.html', (req, res, next) => {
  if (!sessionUser(req)) return res.redirect('/login.html');
  next();
});

app.use(express.static(publicDirectory));

// --- Helpers ---
function sendError(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

function sessionUser(req) {
  const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
  return token ? sessions.get(token) : null;
}

function requireAdmin(req, res, next) {
  const user = sessionUser(req);
  if (!user?.isAdmin) return sendError(res, 'Admin login required', 401);
  req.user = user;
  next();
}

function requireUser(req, res, next) {
  const user = sessionUser(req);
  if (!user) return sendError(res, 'Login required', 401);
  req.user = user;
  next();
}

async function withDatabase(callback) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    return await callback(connection);
  } finally {
    await connection.end();
  }
}

async function initDB() {
  const serverConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl
  });
  try {
    await serverConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
  } finally {
    await serverConnection.end();
  }

  await withDatabase(async connection => {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullName VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        isAdmin TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        category VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        reply_text TEXT NULL,
        reply_read TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        replied_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Migrations for existing installations
    const [feedbackColumns] = await connection.query('SHOW COLUMNS FROM feedback');
    const existingColumns = new Set(feedbackColumns.map(col => col.Field));
    const migrations = [
      ['user_id',     'ALTER TABLE feedback ADD COLUMN user_id INT NULL'],
      ['reply_text',  'ALTER TABLE feedback ADD COLUMN reply_text TEXT NULL'],
      ['reply_read',  'ALTER TABLE feedback ADD COLUMN reply_read TINYINT(1) NOT NULL DEFAULT 0'],
      ['status',      "ALTER TABLE feedback ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'"],
      ['replied_at',  'ALTER TABLE feedback ADD COLUMN replied_at DATETIME NULL']
    ];
    for (const [column, migration] of migrations) {
      if (!existingColumns.has(column)) await connection.query(migration);
    }

    // --- Songs / Karaoke Table ---
    await connection.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        vocal_audio_url VARCHAR(500) NULL,
        instrumental_audio_url VARCHAR(500) NULL,
        lyrics LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [songColumns] = await connection.query('SHOW COLUMNS FROM songs');
    const existingSongColumns = new Set(songColumns.map(col => col.Field));
    const songMigrations = [
      ['vocal_audio_url',        'ALTER TABLE songs ADD COLUMN vocal_audio_url VARCHAR(500) NULL'],
      ['instrumental_audio_url', 'ALTER TABLE songs ADD COLUMN instrumental_audio_url VARCHAR(500) NULL'],
      ['lyrics',                 'ALTER TABLE songs ADD COLUMN lyrics LONGTEXT NULL']
    ];
    for (const [col, sql] of songMigrations) {
      if (!existingSongColumns.has(col)) await connection.query(sql);
    }

    const [[songCountRow]] = await connection.query('SELECT COUNT(*) AS count FROM songs');
    if (Number(songCountRow.count) === 0) {
      for (const song of defaultSongs) {
        await connection.execute(
          'INSERT INTO songs (title, vocal_audio_url, instrumental_audio_url, lyrics) VALUES (?, ?, ?, ?)',
          [song.title, song.vocal_audio_url || '', song.instrumental_audio_url || '', song.lyrics || '']
        );
      }
    }

    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAIL) {
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await connection.execute(
        `INSERT INTO users (fullName, email, username, password, isAdmin)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE isAdmin = 1`,
        [process.env.ADMIN_NAME || 'Administrator', process.env.ADMIN_EMAIL, process.env.ADMIN_USERNAME, passwordHash]
      );
    }
  });
}

// --- Health ---
app.get('/api/health', async (req, res) => {
  try {
    await withDatabase(connection => connection.query('SELECT 1'));
    res.json({ success: true, database: 'connected' });
  } catch (error) {
    sendError(res, `Database unavailable: ${error.message}`, 503);
  }
});

// --- Auth ---
app.post('/register', async (req, res) => {
  const { fullName, email, username, password } = req.body;
  if (!fullName || !email || !username || !password) {
    return sendError(res, 'All fields are required', 400);
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await withDatabase(connection => connection.execute(
      'INSERT INTO users (fullName, email, username, password) VALUES (?, ?, ?, ?)',
      [fullName.trim(), email.trim().toLowerCase(), username.trim(), passwordHash]
    ));
    res.status(201).json({ success: true, message: 'Registration successful.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 'Email or username already exists', 409);
    console.error('Registration error:', error.message);
    sendError(res, 'Could not create the account.');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return sendError(res, 'Username and password are required', 400);
  try {
    const [rows] = await withDatabase(connection => connection.execute(
      'SELECT id, fullName, username, password, isAdmin FROM users WHERE username = ?',
      [username.trim()]
    ));
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password))) {
      return sendError(res, 'Invalid username or password', 401);
    }
    const user = {
      id: rows[0].id,
      fullName: rows[0].fullName,
      username: rows[0].username,
      isAdmin: rows[0].isAdmin === 1
    };
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, user);
    res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/`);
    res.json({ success: true, message: `Welcome ${user.fullName}!`, isAdmin: user.isAdmin });
  } catch (error) {
    console.error('Login error:', error.message);
    sendError(res, 'Could not log in.');
  }
});

app.post('/logout', (req, res) => {
  const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Max-Age=0; SameSite=Lax; Path=/');
  res.json({ success: true });
});

// --- Feedback (user) ---
app.post('/feedback', requireUser, async (req, res) => {
  const { category, message } = req.body;
  if (!category || !message) return sendError(res, 'Category and feedback are required', 400);
  const trimmedCategory = String(category).trim();
  const trimmedMessage  = String(message).trim();
  if (!trimmedCategory || !trimmedMessage) return sendError(res, 'Category and feedback are required', 400);
  try {
    await withDatabase(connection => connection.execute(
      'INSERT INTO feedback (user_id, category, message) VALUES (?, ?, ?)',
      [req.user.id, trimmedCategory, trimmedMessage]
    ));
    res.status(201).json({ success: true, message: 'Feedback submitted. Check your Notifications tab for admin replies.' });
  } catch (error) {
    console.error('Feedback error:', error.message);
    sendError(res, 'Could not save feedback.');
  }
});

// User: view own feedback + replies
app.get('/api/my-feedback', requireUser, async (req, res) => {
  try {
    const [rows] = await withDatabase(connection => connection.execute(
      `SELECT id, category, message, reply_text, reply_read, status, created_at, replied_at
       FROM feedback WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    ));
    res.json(rows);
  } catch (error) {
    console.error('My feedback error:', error.message);
    sendError(res, 'Could not load your feedback.');
  }
});

// User: count of unread admin replies (for notification badge)
app.get('/api/my-feedback/unread-count', requireUser, async (req, res) => {
  try {
    const [[row]] = await withDatabase(connection => connection.execute(
      `SELECT COUNT(*) AS count FROM feedback
       WHERE user_id = ? AND reply_text IS NOT NULL AND reply_read = 0`,
      [req.user.id]
    ));
    res.json({ count: Number(row.count) });
  } catch (error) {
    console.error('Unread count error:', error.message);
    sendError(res, 'Could not get notification count.');
  }
});

// User: mark a reply as read
app.put('/api/my-feedback/:id/read', requireUser, async (req, res) => {
  const feedbackId = Number(req.params.id);
  if (!Number.isInteger(feedbackId) || feedbackId < 1) return sendError(res, 'Invalid feedback entry', 400);
  try {
    await withDatabase(connection => connection.execute(
      'UPDATE feedback SET reply_read = 1 WHERE id = ? AND user_id = ?',
      [feedbackId, req.user.id]
    ));
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error.message);
    sendError(res, 'Could not update notification.');
  }
});

// --- Feedback (admin) ---
app.get('/feedback', requireAdmin, async (req, res) => {
  try {
    const [rows] = await withDatabase(connection => connection.query(
      `SELECT f.id, COALESCE(u.fullName, 'Unknown') AS name, f.category, f.message,
              f.reply_text, f.status, f.created_at, f.replied_at
       FROM feedback f
       LEFT JOIN users u ON f.user_id = u.id
       ORDER BY f.created_at DESC`
    ));
    res.json(rows);
  } catch (error) {
    console.error('Feedback list error:', error.message);
    sendError(res, 'Could not load feedback.');
  }
});

app.put('/feedback/:id/reply', requireAdmin, async (req, res) => {
  const feedbackId = Number(req.params.id);
  const reply = String(req.body.reply || '').trim();
  if (!Number.isInteger(feedbackId) || feedbackId < 1) return sendError(res, 'Invalid feedback entry', 400);
  if (!reply || reply.length > 5000) return sendError(res, 'Reply must be between 1 and 5000 characters', 400);
  try {
    const [result] = await withDatabase(connection => connection.execute(
      `UPDATE feedback
       SET reply_text = ?, reply_read = 0, status = 'replied', replied_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reply, feedbackId]
    ));
    if (!result.affectedRows) return sendError(res, 'Feedback entry not found', 404);
    res.json({ success: true, message: 'Reply saved.' });
  } catch (error) {
    console.error('Feedback reply error:', error.message);
    sendError(res, 'Could not save the reply.');
  }
});

// --- Songs & Karaoke API ---
app.get('/api/songs', async (req, res) => {
  try {
    const [rows] = await withDatabase(connection => connection.query(
      'SELECT id, title, vocal_audio_url, instrumental_audio_url, lyrics, created_at FROM songs ORDER BY id ASC'
    ));
    res.json(rows.length ? rows : fallbackSongs);
  } catch (error) {
    res.json(fallbackSongs);
  }
});

app.get('/api/songs/:id', async (req, res) => {
  const songId = Number(req.params.id);
  if (!Number.isInteger(songId) || songId < 1) return sendError(res, 'Invalid song ID', 400);
  try {
    const [rows] = await withDatabase(connection => connection.execute(
      'SELECT id, title, vocal_audio_url, instrumental_audio_url, lyrics, created_at FROM songs WHERE id = ?',
      [songId]
    ));
    if (!rows.length) return sendError(res, 'Song not found', 404);
    res.json(rows[0]);
  } catch (error) {
    const found = fallbackSongs.find(s => s.id === songId);
    if (found) return res.json(found);
    sendError(res, 'Could not retrieve song');
  }
});

app.post('/api/songs', requireAdmin, handleSongUpload, async (req, res) => {
  let title = String(req.body.title || '').trim();
  let lyrics = req.body.lyrics !== undefined ? String(req.body.lyrics).trim() : '';

  // If a .lrc file was uploaded, read its contents
  if (req.files?.lrc_file?.[0]) {
    try {
      const lrcFile = req.files.lrc_file[0];
      let fileContent;
      if (useCloudinary) {
        // Cloudinary raw files: fetch content from the returned URL
        const https = require('https');
        fileContent = await new Promise((resolve, reject) => {
          const url = lrcFile.path;
          https.get(url, (resp) => {
            let data = '';
            resp.on('data', chunk => { data += chunk; });
            resp.on('end', () => resolve(data));
          }).on('error', reject);
        });
      } else {
        fileContent = fs.readFileSync(lrcFile.path, 'utf8');
        fs.unlink(lrcFile.path, () => {}); // clean up local temp file
      }
      if (fileContent && fileContent.trim()) {
        lyrics = fileContent.trim();
        const titleMatch = lyrics.match(/\[ti:([^\]]+)\]/i);
        if (!title && titleMatch) title = titleMatch[1].trim();
      }
    } catch (err) {
      console.warn('Could not read uploaded lrc file:', err.message);
    }
  }

  if (!title) return sendError(res, 'Song title is required', 400);

  let vocalUrl = String(req.body.vocal_audio_url || '').trim();
  let instrumentalUrl = String(req.body.instrumental_audio_url || '').trim();

  if (req.files?.vocal?.[0]) {
    vocalUrl = getUploadedFileUrl(req.files.vocal[0]);
  }
  if (req.files?.instrumental?.[0]) {
    instrumentalUrl = getUploadedFileUrl(req.files.instrumental[0]);
  }

  try {
    let insertedId;
    await withDatabase(async connection => {
      const [result] = await connection.execute(
        'INSERT INTO songs (title, vocal_audio_url, instrumental_audio_url, lyrics) VALUES (?, ?, ?, ?)',
        [title, vocalUrl || null, instrumentalUrl || null, lyrics || null]
      );
      insertedId = result.insertId;
    });

    const newSong = {
      id: insertedId || (fallbackSongs.length ? Math.max(...fallbackSongs.map(s => s.id)) + 1 : 1),
      title,
      vocal_audio_url: vocalUrl,
      instrumental_audio_url: instrumentalUrl,
      lyrics,
      created_at: new Date().toISOString()
    };
    fallbackSongs.push(newSong);
    res.status(201).json({ success: true, message: 'Hymn published successfully.', song: newSong });
  } catch (error) {
    console.error('Add song error:', error.message);
    const newSong = {
      id: fallbackSongs.length ? Math.max(...fallbackSongs.map(s => s.id)) + 1 : 1,
      title,
      vocal_audio_url: vocalUrl,
      instrumental_audio_url: instrumentalUrl,
      lyrics,
      created_at: new Date().toISOString()
    };
    fallbackSongs.push(newSong);
    res.status(201).json({ success: true, message: 'Hymn published successfully.', song: newSong });
  }
});

app.put('/api/songs/:id', requireAdmin, handleSongUpload, async (req, res) => {
  const songId = Number(req.params.id);
  if (!Number.isInteger(songId) || songId < 1) return sendError(res, 'Invalid song ID', 400);

  let title = req.body.title !== undefined ? String(req.body.title).trim() : null;
  let lyrics = req.body.lyrics !== undefined ? String(req.body.lyrics).trim() : null;

  // If a .lrc file was uploaded, read its contents
  if (req.files?.lrc_file?.[0]) {
    try {
      const lrcFile = req.files.lrc_file[0];
      let fileContent;
      if (useCloudinary) {
        const https = require('https');
        fileContent = await new Promise((resolve, reject) => {
          https.get(lrcFile.path, (resp) => {
            let data = '';
            resp.on('data', chunk => { data += chunk; });
            resp.on('end', () => resolve(data));
          }).on('error', reject);
        });
      } else {
        fileContent = fs.readFileSync(lrcFile.path, 'utf8');
        fs.unlink(lrcFile.path, () => {});
      }
      if (fileContent && fileContent.trim()) {
        lyrics = fileContent.trim();
        const titleMatch = lyrics.match(/\[ti:([^\]]+)\]/i);
        if ((!title || title === '') && titleMatch) {
          title = titleMatch[1].trim();
        }
      }
    } catch (err) {
      console.warn('Could not read uploaded lrc file:', err.message);
    }
  }

  if (title === '') return sendError(res, 'Song title cannot be empty', 400);

  let newVocalUrl = req.body.vocal_audio_url !== undefined ? String(req.body.vocal_audio_url).trim() : null;
  let newInstrumentalUrl = req.body.instrumental_audio_url !== undefined ? String(req.body.instrumental_audio_url).trim() : null;

  if (req.files?.vocal?.[0]) {
    newVocalUrl = getUploadedFileUrl(req.files.vocal[0]);
  }
  if (req.files?.instrumental?.[0]) {
    newInstrumentalUrl = getUploadedFileUrl(req.files.instrumental[0]);
  }

  try {
    await withDatabase(async connection => {
      const [existing] = await connection.execute('SELECT * FROM songs WHERE id = ?', [songId]);
      if (!existing.length) throw new Error('Song not found');
      const cur = existing[0];
      const updatedTitle = title !== null ? title : cur.title;
      const updatedVocal = newVocalUrl !== null ? newVocalUrl : cur.vocal_audio_url;
      const updatedInst = newInstrumentalUrl !== null ? newInstrumentalUrl : cur.instrumental_audio_url;
      const updatedLyrics = lyrics !== null ? lyrics : cur.lyrics;

      await connection.execute(
        'UPDATE songs SET title = ?, vocal_audio_url = ?, instrumental_audio_url = ?, lyrics = ? WHERE id = ?',
        [updatedTitle, updatedVocal, updatedInst, updatedLyrics, songId]
      );
    });

    const idx = fallbackSongs.findIndex(s => s.id === songId);
    if (idx !== -1) {
      if (title !== null) fallbackSongs[idx].title = title;
      if (newVocalUrl !== null) fallbackSongs[idx].vocal_audio_url = newVocalUrl;
      if (newInstrumentalUrl !== null) fallbackSongs[idx].instrumental_audio_url = newInstrumentalUrl;
      if (lyrics !== null) fallbackSongs[idx].lyrics = lyrics;
    }

    res.json({ success: true, message: 'Hymn updated successfully.' });
  } catch (error) {
    console.error('Update song error:', error.message);
    const idx = fallbackSongs.findIndex(s => s.id === songId);
    if (idx !== -1) {
      if (title !== null) fallbackSongs[idx].title = title;
      if (newVocalUrl !== null) fallbackSongs[idx].vocal_audio_url = newVocalUrl;
      if (newInstrumentalUrl !== null) fallbackSongs[idx].instrumental_audio_url = newInstrumentalUrl;
      if (lyrics !== null) fallbackSongs[idx].lyrics = lyrics;
      return res.json({ success: true, message: 'Hymn updated successfully.' });
    }
    sendError(res, error.message || 'Could not update hymn');
  }
});

app.delete('/api/songs/:id', requireAdmin, async (req, res) => {
  const songId = Number(req.params.id);
  if (!Number.isInteger(songId) || songId < 1) return sendError(res, 'Invalid song ID', 400);

  try {
    let toDeleteLocal = [];
    let toDeleteCloudinary = [];
    await withDatabase(async connection => {
      const [rows] = await connection.execute('SELECT vocal_audio_url, instrumental_audio_url FROM songs WHERE id = ?', [songId]);
      if (rows.length) {
        [rows[0].vocal_audio_url, rows[0].instrumental_audio_url].forEach(url => {
          if (!url) return;
          if (url.startsWith('/uploads/audio/')) {
            toDeleteLocal.push(path.join(publicDirectory, url));
          } else if (url.includes('cloudinary.com')) {
            // Extract public_id from Cloudinary URL (everything after /upload/vXXX/)
            const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
            if (match) toDeleteCloudinary.push(match[1]);
          }
        });
      }
      await connection.execute('DELETE FROM songs WHERE id = ?', [songId]);
    });

    // Clean up local files
    toDeleteLocal.forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) { /* ignore */ }
    });
    // Clean up Cloudinary files (non-blocking)
    if (useCloudinary && toDeleteCloudinary.length) {
      toDeleteCloudinary.forEach(pid => {
        cloudinary.uploader.destroy(pid, { resource_type: 'video' }).catch(() => {});
      });
    }

    fallbackSongs = fallbackSongs.filter(s => s.id !== songId);
    res.json({ success: true, message: 'Hymn removed successfully.' });
  } catch (error) {
    fallbackSongs = fallbackSongs.filter(s => s.id !== songId);
    res.json({ success: true, message: 'Hymn removed successfully.' });
  }
});

// --- Stats & session ---
app.get('/api/stats', requireAdmin, async (req, res) => {
  try {
    const [rows] = await withDatabase(connection => connection.query(
      `SELECT COUNT(*) AS total,
        COALESCE(SUM(category = 'Improvement Suggestion'), 0) AS suggestions,
        COALESCE(SUM(category = 'Concern'), 0) AS concerns,
        COALESCE(SUM(category = 'Appreciation'), 0) AS appreciations
       FROM feedback`
    ));
    res.json(rows[0]);
  } catch (error) {
    sendError(res, 'Could not load statistics.');
  }
});

app.get('/api/session', (req, res) => {
  const user = sessionUser(req);
  res.json({ authenticated: Boolean(user), user: user || null });
});

// Explicit root — serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'), err => {
    if (err) { console.error('sendFile error:', err); res.status(500).send('Server error'); }
  });
});

// Fallback for unknown routes — send landing page
app.use((req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'), err => {
    if (err) { console.error('sendFile error:', err); res.status(500).send('Server error'); }
  });
});

async function start() {
  try {
    await initDB();
    console.log('Database initialized.');
  } catch (error) {
    console.error(`Database unavailable: ${error.message}`);
    console.error('Start MySQL and verify DB settings before using database features.');
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

start();