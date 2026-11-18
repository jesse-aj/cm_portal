if (
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    window.location.port === '5500'
) {
    const appPath = window.location.pathname.replace(/^\/public(?=\/)/, '') || '/';
    window.location.replace(`http://${window.location.hostname}:3000${appPath}${window.location.search}${window.location.hash}`);
}

// --- Shared fetch helper ---
async function sendJson(url, options = {}) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
    });
    const responseText = await response.text();
    let data;
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error('The server returned an unexpected response. Open this site through http://localhost:3000 and try again.');
    }
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }
    )[c]);
}

// --- Personalize User Masthead if logged in ---
async function loadUserGreeting() {
    const greetingEl = document.getElementById('welcomeGreeting');
    if (!greetingEl) return;
    try {
        const session = await sendJson('/api/session');
        if (session.user?.fullName) {
            greetingEl.textContent = `Welcome, ${session.user.fullName}`;
        }
    } catch {
        // ignore
    }
}
loadUserGreeting();

// --- Register ---
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(registerForm);
        if (formData.get('password') !== formData.get('confirmPassword')) {
            alert('Passwords do not match.');
            return;
        }
        try {
            const result = await sendJson('/register', {
                method: 'POST',
                body: JSON.stringify({
                    fullName: formData.get('fullName'),
                    email: formData.get('email'),
                    username: formData.get('username'),
                    password: formData.get('password')
                })
            });
            alert(result.message);
            window.location.href = 'login.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

// --- Login ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(loginForm);
        try {
            const result = await sendJson('/login', {
                method: 'POST',
                body: JSON.stringify({
                    username: formData.get('username'),
                    password: formData.get('password')
                })
            });
            window.location.href = result.isAdmin ? 'admin.html' : 'user.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

// --- User: Submit Feedback ---
const userFeedbackForm = document.getElementById('userFeedbackForm');
if (userFeedbackForm) {
    userFeedbackForm.addEventListener('submit', async event => {
        event.preventDefault();
        const notice = document.getElementById('feedbackNotice');
        const formData = new FormData(userFeedbackForm);
        try {
            const result = await sendJson('/feedback', {
                method: 'POST',
                body: JSON.stringify({
                    category: formData.get('category'),
                    message: formData.get('message')
                })
            });
            notice.textContent = result.message;
            notice.hidden = false;
            userFeedbackForm.reset();
            loadUnreadCount();
        } catch (error) {
            notice.textContent = error.message;
            notice.hidden = false;
        }
    });
}

// --- User: Notifications tab ---
async function loadMyFeedback() {
    const list = document.getElementById('notificationsList');
    if (!list) return;
    try {
        const items = await sendJson('/api/my-feedback');
        if (!items.length) {
            list.innerHTML = '<div class="editorial-card"><p class="section-sub">You have not submitted any correspondence yet.</p></div>';
            return;
        }
        list.innerHTML = items.map(item => {
            const hasReply  = Boolean(item.reply_text);
            const isUnread  = hasReply && !item.reply_read;
            const cardClass = isUnread ? 'notif-card notif-unread' : 'notif-card';
            const date      = new Date(item.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
            return `
            <div class="${cardClass}" data-id="${item.id}">
                <div class="notif-meta">
                    <span class="notif-category">${escapeHtml(item.category)}</span>
                    <span class="notif-date">${date}</span>
                    <span class="notif-status status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
                </div>
                <p class="notif-message">${escapeHtml(item.message)}</p>
                ${hasReply ? `
                <div class="notif-reply">
                    <strong>CM Leadership Response</strong>
                    <p>${escapeHtml(item.reply_text)}</p>
                    ${isUnread ? `<button class="mark-read-btn" data-id="${item.id}">Mark as Read</button>` : ''}
                </div>` : '<p class="notif-pending">Awaiting review by the CM leadership team.</p>'}
            </div>`;
        }).join('');

        // Mark-as-read buttons
        list.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = Number(btn.dataset.id);
                try {
                    await sendJson(`/api/my-feedback/${id}/read`, { method: 'PUT' });
                    await loadMyFeedback();
                    await loadUnreadCount();
                } catch {
                    // silently ignore
                }
            });
        });
    } catch (error) {
        list.innerHTML = `<p style="color:#b91c1c;">${escapeHtml(error.message)}</p>`;
    }
}

async function loadUnreadCount() {
    const badge = document.getElementById('unreadBadge');
    if (!badge) return;
    try {
        const data = await sendJson('/api/my-feedback/unread-count');
        if (data.count > 0) {
            badge.textContent = data.count;
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    } catch {
        badge.hidden = true;
    }
}

// Load notifications when the tab is clicked
const notificationsTab = document.getElementById('notificationsTab');
if (notificationsTab) {
    notificationsTab.addEventListener('click', () => {
        loadMyFeedback();
    });
    loadUnreadCount();
}

// --- Admin: load and display feedback ---
async function loadAdminFeedback() {
    const table = document.getElementById('feedbackTable');
    if (!table) return;
    try {
        const feedback = await sendJson('/feedback');
        if (!feedback.length) {
            table.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:#6B7280;">No feedback correspondence recorded yet.</td></tr>';
            return;
        }
        table.innerHTML = feedback.map(item => {
            const isReplied = Boolean(item.reply_text);
            const statusClass = isReplied ? 'pill-replied' : 'pill-pending';
            const statusLabel = isReplied ? 'Replied' : 'Pending';
            const dateStr = new Date(item.created_at).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            return `
            <tr>
                <td><strong>${escapeHtml(item.name)}</strong></td>
                <td><span class="admin-pill pill-category">${escapeHtml(item.category)}</span></td>
                <td>${escapeHtml(item.message)}</td>
                <td><span class="admin-pill ${statusClass}">${statusLabel}</span></td>
                <td style="font-family:var(--font-mono); font-size:12px; white-space:nowrap;">${dateStr}</td>
                <td>
                    <form class="admin-reply-form" data-feedback-id="${item.id}">
                        <textarea name="reply" maxlength="5000" required placeholder="Compose official reply...">${escapeHtml(item.reply_text || '')}</textarea>
                        <button type="submit">${isReplied ? 'Update Reply' : 'Send Reply'}</button>
                    </form>
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        table.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
    }
}

const feedbackTable = document.getElementById('feedbackTable');
if (feedbackTable) {
    feedbackTable.addEventListener('submit', async event => {
        const form = event.target.closest('.admin-reply-form');
        if (!form) return;
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const result = await sendJson(`/feedback/${form.dataset.feedbackId}/reply`, {
                method: 'PUT',
                body: JSON.stringify({ reply: new FormData(form).get('reply') })
            });
            alert(result.message);
            await loadAdminFeedback();
            await loadAdminStats();
        } catch (error) {
            alert(error.message);
            button.disabled = false;
        }
    });
}

// --- Admin: stats ---
async function loadAdminStats() {
    if (!document.getElementById('totalFeedback')) return;
    try {
        const session = await sendJson('/api/session');
        if (!session.user?.isAdmin) {
            window.location.href = 'login.html';
            return;
        }
        const stats = await sendJson('/api/stats');
        document.getElementById('totalFeedback').textContent  = stats.total;
        document.getElementById('suggestions').textContent    = stats.suggestions;
        document.getElementById('concerns').textContent       = stats.concerns;
        document.getElementById('appreciations').textContent  = stats.appreciations;
    } catch (error) {
        ['totalFeedback', 'suggestions', 'concerns', 'appreciations'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });
        console.error(error);
    }
}

// --- Admin: clear all feedback ---
window.clearFeedback = async function clearFeedback() {
    if (!confirm('Are you sure you want to clear all feedback? This cannot be undone.')) return;
    try {
        const result = await sendJson('/feedback', { method: 'DELETE' });
        alert(result.message);
        await loadAdminFeedback();
        await loadAdminStats();
    } catch (error) {
        alert(error.message);
    }
};

// Bootstrap admin page
if (feedbackTable) loadAdminFeedback();
loadAdminStats();

// =========================================================
// SUNDAY SCHOOL HYMNS & AUDIO TRACK MANAGER (ADMIN)
// =========================================================
let adminSongsCache = [];

window.loadAdminSongs = async function loadAdminSongs() {
    const tableBody = document.getElementById('hymnsTableBody');
    if (!tableBody) return;
    try {
        const songs = await sendJson('/api/songs');
        adminSongsCache = songs;
        if (!songs.length) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--ink-500);">No hymns found in the ministry catalog. Click "+ Add New Hymn" to add one!</td></tr>';
            return;
        }
        tableBody.innerHTML = songs.map(song => {
            const hasVocal = Boolean(song.vocal_audio_url);
            const hasInst = Boolean(song.instrumental_audio_url);
            const vocalPill = hasVocal
                ? `<span class="track-pill present">🎤 Track Ready</span>`
                : `<span class="track-pill missing">Missing</span>`;
            const instPill = hasInst
                ? `<span class="track-pill present">🎹 Track Ready</span>`
                : `<span class="track-pill missing">Missing</span>`;

            const parsed = parseLyricsData(song.lyrics);
            const lyricsBadge = parsed.hasTimestamps
                ? `<span class="admin-pill pill-category">⏱ Synchronized (${parsed.lines.length} lines)</span>`
                : (parsed.lines.length
                    ? `<span class="admin-pill pill-replied">Text (${parsed.lines.length} lines)</span>`
                    : `<span class="admin-pill pill-pending">None</span>`);

            const previewAudio = song.vocal_audio_url || song.instrumental_audio_url;
            const previewPlayer = previewAudio
                ? `<audio controls src="${escapeHtml(previewAudio)}" class="mini-audio-player" preload="none"></audio>`
                : `<span style="font-size:12px; color:var(--ink-500);">No audio</span>`;

            return `
            <tr>
                <td><strong>${escapeHtml(song.title)}</strong></td>
                <td>${vocalPill}</td>
                <td>${instPill}</td>
                <td>${lyricsBadge}</td>
                <td>${previewPlayer}</td>
                <td>
                    <button class="btn print" style="padding:5px 10px; font-size:12px;" onclick="openHymnModal(${song.id})">Edit</button>
                    <button class="btn danger" style="padding:5px 10px; font-size:12px;" onclick="deleteHymnSong(${song.id})">Delete</button>
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" style="color:var(--danger); text-align:center; padding:20px;">${escapeHtml(error.message)}</td></tr>`;
    }
};

window.openHymnModal = function openHymnModal(songId = null) {
    const backdrop = document.getElementById('hymnModalBackdrop');
    const form = document.getElementById('hymnForm');
    const titleEl = document.getElementById('hymnModalTitle');
    const submitBtn = document.getElementById('hymnSubmitBtn');
    const currentVocalEl = document.getElementById('hymnCurrentVocal');
    const currentInstEl = document.getElementById('hymnCurrentInstrumental');

    if (!backdrop || !form) return;
    form.reset();
    currentVocalEl.textContent = '';
    currentInstEl.textContent = '';

    if (songId) {
        const song = adminSongsCache.find(s => s.id === Number(songId));
        if (song) {
            document.getElementById('hymnId').value = song.id;
            document.getElementById('hymnTitleInput').value = song.title || '';
            document.getElementById('hymnVocalUrlInput').value = song.vocal_audio_url || '';
            document.getElementById('hymnInstrumentalUrlInput').value = song.instrumental_audio_url || '';
            document.getElementById('hymnLyricsInput').value = song.lyrics || '';
            if (song.vocal_audio_url) currentVocalEl.textContent = `Current: ${song.vocal_audio_url}`;
            if (song.instrumental_audio_url) currentInstEl.textContent = `Current: ${song.instrumental_audio_url}`;
            titleEl.textContent = `Edit Hymn — ${song.title}`;
            submitBtn.textContent = 'Update Hymn';
        }
    } else {
        document.getElementById('hymnId').value = '';
        titleEl.textContent = 'Add Sunday School Hymn';
        submitBtn.textContent = 'Publish Hymn';
    }
    backdrop.style.display = 'flex';
};

window.closeHymnModal = function closeHymnModal() {
    const backdrop = document.getElementById('hymnModalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
};

window.insertTimestampSample = function insertTimestampSample() {
    const textarea = document.getElementById('hymnLyricsInput');
    if (!textarea) return;
    const sample = `[00:00.00] Jesus loves me, this I know,
[00:04.50] For the Bible tells me so;
[00:09.00] Little ones to Him belong;
[00:13.50] They are weak, but He is strong.

[00:18.00] (Chorus)
[00:20.00] Yes, Jesus loves me!
[00:24.50] Yes, Jesus loves me!
[00:29.00] Yes, Jesus loves me!
[00:33.50] The Bible tells me so.`;
    if (!textarea.value.trim() || confirm('Replace existing lyrics with sample timestamps template?')) {
        textarea.value = sample;
    }
};

const hymnAdminForm = document.getElementById('hymnForm');
if (hymnAdminForm) {
    hymnAdminForm.addEventListener('submit', async event => {
        event.preventDefault();
        const submitBtn = document.getElementById('hymnSubmitBtn');
        const songId = document.getElementById('hymnId').value;
        const isEdit = Boolean(songId);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving audio & lyrics…';

        const formData = new FormData(hymnAdminForm);
        const url = isEdit ? `/api/songs/${songId}` : '/api/songs';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                body: formData
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Could not save hymn');
            alert(result.message || 'Hymn saved successfully!');
            closeHymnModal();
            loadAdminSongs();
        } catch (error) {
            alert(error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isEdit ? 'Update Hymn' : 'Publish Hymn';
        }
    });
}

window.deleteHymnSong = async function deleteHymnSong(id) {
    if (!confirm('Are you sure you want to remove this hymn and its audio files?')) return;
    try {
        const result = await sendJson(`/api/songs/${id}`, { method: 'DELETE' });
        alert(result.message || 'Hymn deleted.');
        loadAdminSongs();
    } catch (error) {
        alert(error.message);
    }
};

// Auto-load admin songs if table is present
if (document.getElementById('hymnsTableBody')) {
    loadAdminSongs();
}

window.handleLrcFileUpload = function handleLrcFileUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const statusEl = document.getElementById('hymnLrcFileStatus');
    const summaryEl = document.getElementById('lrcParseSummary');
    const lyricsTextarea = document.getElementById('hymnLyricsInput');
    const titleInput = document.getElementById('hymnTitleInput');

    if (statusEl) statusEl.textContent = `Reading ${file.name}…`;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        lyricsTextarea.value = text;
        const parsed = parseLyricsData(text);

        // Auto-fill title if empty and LRC has [ti:...]
        if (parsed.metadata?.ti && (!titleInput.value || titleInput.value.trim() === '')) {
            titleInput.value = parsed.metadata.ti;
        }

        if (statusEl) {
            statusEl.textContent = `✓ Loaded "${file.name}"`;
        }
        if (summaryEl) {
            if (parsed.hasTimestamps) {
                const offsetNotice = parsed.metadata.offset ? ` (Offset: ${parsed.metadata.offset}ms)` : '';
                summaryEl.innerHTML = `✓ Recognized ${parsed.lines.length} synchronized lines${offsetNotice}`;
                summaryEl.style.color = '#166534';
            } else {
                summaryEl.innerHTML = `Loaded plain text (${parsed.lines.length} lines)`;
                summaryEl.style.color = 'var(--gold-500)';
            }
        }
    };
    reader.onerror = function() {
        if (statusEl) statusEl.textContent = 'Could not read .lrc file.';
    };
    reader.readAsText(file);
};

// =========================================================
// KIDS INTERACTIVE KARAOKE STUDIO (USER PORTAL)
// =========================================================
let userHymns = [];
let activeUserSong = null;
let currentMode = 'vocal'; // 'vocal' or 'instrumental'
let parsedLyricsResult = { hasTimestamps: false, lines: [], metadata: {} };
let activeLineIdx = -1;
let userSyncOffset = 0.0; // In seconds, fine-tuning for audio latency
let syncRafId = null;

/**
 * Robust LRC Parser adhering to standard .lrc specifications:
 * - Supports [offset: +/-ms] (automatically shifts timestamps)
 * - Supports multiple timestamps per line: [00:12.30][01:15.50]Repeat chorus
 * - Supports [mm:ss], [mm:ss.xx], [mm:ss.xxx], [hh:mm:ss.xx]
 * - Strips inline word tags <00:12.34> or |
 * - Detects blank timestamp lines as pauses / instrumental breaks
 * - Computes dynamic line duration (endTime)
 */
function parseLyricsData(text) {
    if (!text || !text.trim()) return { hasTimestamps: false, lines: [], metadata: {} };

    const rawLines = text.split(/\r?\n/);
    const metadata = {};
    let offsetMs = 0;

    // Pass 1: Extract metadata tags like [offset:xxx], [ti:...], [ar:...]
    rawLines.forEach(line => {
        const metaMatch = line.match(/^\[(ti|ar|al|by|offset|length):([^\]]+)\]/i);
        if (metaMatch) {
            const key = metaMatch[1].toLowerCase();
            const val = metaMatch[2].trim();
            metadata[key] = val;
            if (key === 'offset') {
                const parsedOffset = parseFloat(val);
                if (!isNaN(parsedOffset)) offsetMs = parsedOffset;
            }
        }
    });

    const offsetSec = offsetMs / 1000.0;
    const timed = [];
    let hasTs = false;

    // Matches any [mm:ss], [mm:ss.xx], [mm:ss.xxx], or [hh:mm:ss.xx]
    const timestampTagRegex = /\[(\d{1,2}:)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    rawLines.forEach((line, lineIndex) => {
        // Skip pure metadata headers
        if (line.match(/^\[(ti|ar|al|by|offset|length):/i)) return;

        // Extract all timestamps from this line
        const tags = [];
        let match;
        // Reset regex state for fresh line
        timestampTagRegex.lastIndex = 0;
        while ((match = timestampTagRegex.exec(line)) !== null) {
            const hours = match[1] ? parseInt(match[1].replace(':', ''), 10) : 0;
            const minutes = parseInt(match[2], 10);
            const seconds = parseInt(match[3], 10);
            let frac = 0;
            if (match[4]) {
                frac = parseFloat('0.' + match[4]);
            }
            const totalSeconds = hours * 3600 + minutes * 60 + seconds + frac + offsetSec;
            tags.push(Math.max(0, totalSeconds));
        }

        // Clean text: remove timestamp brackets and inline word timestamps
        const cleanText = line
            .replace(/\[\d{1,2}:[^\]]+\]/g, '')
            .replace(/<[^>]+>/g, '')
            .trim();

        if (tags.length > 0) {
            hasTs = true;
            tags.forEach(t => {
                timed.push({
                    time: t,
                    text: cleanText,
                    isBlank: cleanText.length === 0,
                    lineIndex
                });
            });
        } else if (cleanText) {
            timed.push({
                time: null,
                text: cleanText,
                isBlank: false,
                lineIndex
            });
        }
    });

    if (hasTs) {
        // Sort strictly by timestamp
        timed.sort((a, b) => a.time - b.time);

        // Assign end times and preserve structure
        const activeLines = [];
        for (let i = 0; i < timed.length; i++) {
            const cur = timed[i];
            const next = timed[i + 1];
            // Duration until next line (bounded between 0.5s and 10s)
            const duration = next ? Math.max(0.5, next.time - cur.time) : 8;
            cur.endTime = cur.time + duration;
            activeLines.push(cur);
        }

        return {
            hasTimestamps: true,
            lines: activeLines,
            metadata
        };
    } else {
        return {
            hasTimestamps: false,
            lines: timed.filter(item => !item.isBlank),
            metadata
        };
    }
}

function formatSongTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// ---------------- USER KARAOKE PORTAL ----------------
window.initUserKaraoke = async function initUserKaraoke() {
    const listEl = document.getElementById('karaokeHymnsList');
    if (!listEl) return;
    try {
        userHymns = await sendJson('/api/songs');
        renderUserHymns(userHymns);
        if (userHymns.length && !activeUserSong) {
            selectUserHymn(userHymns[0].id);
        }
    } catch (error) {
        listEl.innerHTML = `<li style="padding:16px; color:var(--danger);">${escapeHtml(error.message)}</li>`;
    }
};

function renderUserHymns(hymns) {
    const listEl = document.getElementById('karaokeHymnsList');
    if (!listEl) return;
    if (!hymns.length) {
        listEl.innerHTML = '<li style="padding:16px; color:var(--ink-500); text-align:center;">No hymns match your search.</li>';
        return;
    }
    listEl.innerHTML = hymns.map(song => {
        const isActive = activeUserSong && activeUserSong.id === song.id;
        const vocalTag = song.vocal_audio_url ? '<span class="hymn-tag hymn-tag-vocal">🎤 Sing-Along</span>' : '';
        const instTag = song.instrumental_audio_url ? '<span class="hymn-tag hymn-tag-karaoke">🎹 Karaoke</span>' : '';
        return `
        <li class="karaoke-hymn-item ${isActive ? 'active' : ''}" data-id="${song.id}" onclick="selectUserHymn(${song.id})">
            <div class="hymn-item-header">
                <span class="hymn-item-title">🎵 ${escapeHtml(song.title)}</span>
            </div>
            <div class="hymn-item-tags">
                ${vocalTag}
                ${instTag}
            </div>
        </li>`;
    }).join('');
}

const karaokeSearch = document.getElementById('karaokeSearchInput');
if (karaokeSearch) {
    karaokeSearch.addEventListener('input', () => {
        const q = karaokeSearch.value.toLowerCase().trim();
        const filtered = userHymns.filter(song =>
            song.title.toLowerCase().includes(q) ||
            (song.lyrics && song.lyrics.toLowerCase().includes(q))
        );
        renderUserHymns(filtered);
    });
}

window.selectUserHymn = function selectUserHymn(songId) {
    const song = userHymns.find(s => s.id === Number(songId));
    if (!song) return;
    activeUserSong = song;

    // Highlight in songbook list
    document.querySelectorAll('.karaoke-hymn-item').forEach(el => {
        el.classList.toggle('active', Number(el.dataset.id) === song.id);
    });

    // Update Stage Titles
    const titleEl = document.getElementById('karaokeTitle');
    const subEl = document.getElementById('karaokeSubtitle');
    if (titleEl) titleEl.textContent = song.title;
    if (subEl) subEl.textContent = 'SUNDAY SCHOOL HYMNS & PRAISE';

    // Parse Lyrics using robust LRC engine
    parsedLyricsResult = parseLyricsData(song.lyrics);
    renderLyricsStage();

    // Reset offset calibration to zero for fresh song
    resetSyncOffset(false);

    // Setup Audio Track
    applyAudioSourceForMode(false);
};

function renderLyricsStage() {
    const container = document.getElementById('karaokeLyricsContainer');
    if (!container) return;
    activeLineIdx = -1;

    if (!parsedLyricsResult.lines.length) {
        container.innerHTML = `
            <div style="padding:40px 10px;">
                <p class="karaoke-lyric-line" style="color:rgba(255,255,255,0.7); font-size:18px;">
                    Sing joyfully to the Lord with your voices! 🎶<br>
                    Lyrics for this hymn are being transcribed.
                </p>
            </div>`;
        return;
    }

    container.innerHTML = parsedLyricsResult.lines.map((line, idx) => {
        if (line.isBlank) {
            // Instrumental break / pause line
            return `<div class="karaoke-blank-line" id="lyric-line-${idx}"></div>`;
        }
        const timeAttr = line.time !== null ? `data-time="${line.time}"` : '';
        const titleAttr = line.time !== null ? `title="Jump to ${formatSongTime(line.time)}"` : '';
        return `
        <div class="karaoke-lyric-line" id="lyric-line-${idx}" ${timeAttr} ${titleAttr} onclick="onLyricLineClick(${idx})">
            ${escapeHtml(line.text)}
        </div>`;
    }).join('');
}

window.onLyricLineClick = function onLyricLineClick(idx) {
    const line = parsedLyricsResult.lines[idx];
    if (!line || line.isBlank) return;
    const audio = document.getElementById('karaokeAudio');
    if (line.time !== null && audio) {
        audio.currentTime = Math.max(0, line.time - userSyncOffset);
        if (audio.paused) audio.play();
        highlightActiveLyricLine(idx);
    } else {
        highlightActiveLyricLine(idx);
    }
};

window.setKaraokeMode = function setKaraokeMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    const vocalBtn = document.getElementById('vocalToggleBtn');
    const instBtn = document.getElementById('instrumentalToggleBtn');
    if (vocalBtn && instBtn) {
        vocalBtn.classList.toggle('active', mode === 'vocal');
        instBtn.classList.toggle('active', mode === 'instrumental');
        instBtn.classList.toggle('karaoke-mode-active', mode === 'instrumental');
    }

    applyAudioSourceForMode(true);
};

function applyAudioSourceForMode(preserveTime = false) {
    const audio = document.getElementById('karaokeAudio');
    const notice = document.getElementById('karaokeAudioNotice');
    const statusBadge = document.getElementById('trackStatusBadge');
    if (!audio || !activeUserSong) return;

    const targetUrl = currentMode === 'vocal'
        ? activeUserSong.vocal_audio_url
        : activeUserSong.instrumental_audio_url;

    const prevTime = preserveTime ? audio.currentTime : 0;
    const wasPlaying = !audio.paused && audio.currentTime > 0;

    if (notice) notice.style.display = 'none';

    if (targetUrl) {
        audio.src = targetUrl;
        audio.load();
        if (preserveTime && prevTime > 0) {
            audio.addEventListener('loadedmetadata', () => {
                if (prevTime < audio.duration) audio.currentTime = prevTime;
                if (wasPlaying) audio.play();
            }, { once: true });
        } else if (wasPlaying) {
            audio.play();
        }

        if (statusBadge) {
            statusBadge.textContent = currentMode === 'vocal' ? '🎤 Vocal Track Loaded' : '🎹 Instrumental Track Loaded';
            statusBadge.style.background = currentMode === 'vocal' ? '#E0E7FF' : '#FEF3C7';
            statusBadge.style.color = currentMode === 'vocal' ? '#3730A3' : '#92400E';
        }
    } else {
        audio.pause();
        stopSyncLoop();
        audio.removeAttribute('src');
        if (statusBadge) {
            statusBadge.textContent = currentMode === 'vocal' ? 'No Vocal Audio Track' : 'No Instrumental Audio Track';
            statusBadge.style.background = '#FEE2E2';
            statusBadge.style.color = '#991B1B';
        }
        if (notice) {
            notice.textContent = currentMode === 'vocal'
                ? 'Sing-Along track is in preparation by teachers. Practice singing with the lyrics below! 🎶'
                : 'Instrumental karaoke track is not yet uploaded for this song. You can switch to Sing-Along mode!';
            notice.style.display = 'block';
        }
    }
}

// ---------------- HIGH PRECISION SYNC LOOP (RAF) ----------------
function startSyncLoop() {
    stopSyncLoop();
    function tick() {
        const audio = document.getElementById('karaokeAudio');
        if (audio && !audio.paused && !audio.ended) {
            updateKaraokeSync(audio.currentTime, audio.duration || 0);
            syncRafId = requestAnimationFrame(tick);
        }
    }
    syncRafId = requestAnimationFrame(tick);
}

function stopSyncLoop() {
    if (syncRafId) {
        cancelAnimationFrame(syncRafId);
        syncRafId = null;
    }
}

function updateKaraokeSync(cur, dur) {
    const timeDisplay = document.getElementById('karaokeTimeDisplay');
    const progressBar = document.getElementById('karaokeProgress');

    if (timeDisplay) timeDisplay.textContent = `${formatSongTime(cur)} / ${formatSongTime(dur)}`;
    if (progressBar && dur > 0) {
        progressBar.value = Math.floor((cur / dur) * 1000);
    }

    if (!parsedLyricsResult.hasTimestamps || !parsedLyricsResult.lines.length) return;

    // Apply sync calibration offset (effective listening time)
    const effTime = Math.max(0, cur + userSyncOffset);

    let activeIdx = -1;
    for (let i = 0; i < parsedLyricsResult.lines.length; i++) {
        const line = parsedLyricsResult.lines[i];
        if (effTime >= line.time) {
            if (!line.endTime || effTime < line.endTime) {
                activeIdx = i;
            } else if (i === parsedLyricsResult.lines.length - 1) {
                activeIdx = i;
            }
        } else {
            break;
        }
    }

    if (activeIdx !== activeLineIdx) {
        highlightActiveLyricLine(activeIdx);
    }
}

function highlightActiveLyricLine(idx) {
    activeLineIdx = idx;
    const stage = document.getElementById('lyricsStage');
    const container = document.getElementById('karaokeLyricsContainer');
    if (!stage || !container) return;

    // If active line is an empty line (instrumental break), clear highlight
    const isBlankLine = idx >= 0 && parsedLyricsResult.lines[idx]?.isBlank;

    parsedLyricsResult.lines.forEach((_, i) => {
        const el = document.getElementById(`lyric-line-${i}`);
        if (!el) return;
        el.classList.remove('active', 'passed');
        if (i < idx) el.classList.add('passed');
        if (i === idx && !isBlankLine) el.classList.add('active');
    });

    if (idx >= 0 && !isBlankLine) {
        const activeEl = document.getElementById(`lyric-line-${idx}`);
        if (activeEl) {
            const targetScroll = activeEl.offsetTop - (stage.clientHeight / 2) + (activeEl.clientHeight / 2);
            stage.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
        }
    }
}

// ---------------- SYNC OFFSET CALIBRATION ----------------
window.adjustSyncOffset = function adjustSyncOffset(delta) {
    userSyncOffset = Math.round((userSyncOffset + delta) * 100) / 100;
    updateSyncOffsetDisplay();
    const audio = document.getElementById('karaokeAudio');
    if (audio) {
        updateKaraokeSync(audio.currentTime, audio.duration || 0);
    }
};

window.resetSyncOffset = function resetSyncOffset(triggerSync = true) {
    userSyncOffset = 0.0;
    updateSyncOffsetDisplay();
    if (triggerSync) {
        const audio = document.getElementById('karaokeAudio');
        if (audio) updateKaraokeSync(audio.currentTime, audio.duration || 0);
    }
};

function updateSyncOffsetDisplay() {
    const el = document.getElementById('syncOffsetDisplay');
    if (!el) return;
    const sign = userSyncOffset > 0 ? '+' : '';
    el.textContent = `${sign}${userSyncOffset.toFixed(1)}s`;
    el.style.color = userSyncOffset === 0 ? 'var(--gold-500)' : '#10B981';
}

// ---------------- AUDIO CONTROLS & LISTENERS ----------------
const userAudioEl = document.getElementById('karaokeAudio');
if (userAudioEl) {
    userAudioEl.addEventListener('play', () => {
        const btn = document.getElementById('karaokePlayBtn');
        if (btn) btn.textContent = '⏸';
        startSyncLoop();
    });

    userAudioEl.addEventListener('pause', () => {
        const btn = document.getElementById('karaokePlayBtn');
        if (btn) btn.textContent = '▶';
        stopSyncLoop();
    });

    userAudioEl.addEventListener('ended', () => {
        const btn = document.getElementById('karaokePlayBtn');
        if (btn) btn.textContent = '▶';
        stopSyncLoop();
    });

    // Handle user scrub / seek while paused
    userAudioEl.addEventListener('timeupdate', () => {
        if (userAudioEl.paused) {
            updateKaraokeSync(userAudioEl.currentTime, userAudioEl.duration || 0);
        }
    });
}

window.toggleKaraokePlay = function toggleKaraokePlay() {
    const audio = document.getElementById('karaokeAudio');
    if (!audio) return;
    if (!audio.src) {
        alert('No audio track is currently loaded for this hymn. Practice singing with the synchronized lyrics on screen!');
        return;
    }
    if (audio.paused) {
        audio.play().catch(e => console.warn('Audio play error:', e.message));
    } else {
        audio.pause();
    }
};

window.restartKaraokeSong = function restartKaraokeSong() {
    const audio = document.getElementById('karaokeAudio');
    if (!audio) return;
    audio.currentTime = 0;
    if (audio.src) {
        audio.play().catch(e => console.warn(e.message));
    }
    highlightActiveLyricLine(0);
};

window.onSeekKaraoke = function onSeekKaraoke(val) {
    const audio = document.getElementById('karaokeAudio');
    if (!audio || !audio.duration) return;
    audio.currentTime = (val / 1000) * audio.duration;
    updateKaraokeSync(audio.currentTime, audio.duration);
};

window.onVolumeChange = function onVolumeChange(val) {
    const audio = document.getElementById('karaokeAudio');
    if (audio) audio.volume = parseFloat(val);
};

// Auto-initialize karaoke studio if on user page
if (document.getElementById('karaokeHymnsList')) {
    initUserKaraoke();
}

