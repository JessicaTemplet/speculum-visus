import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';

// ─── Config ───────────────────────────────────────────────────────────────────
// Move these to a .env file: VITE_API_TOKEN and VITE_GROUP_ID
// Then reference them as import.meta.env.VITE_API_TOKEN etc.
const API_TOKEN = import.meta.env.VITE_API_TOKEN;
const GROUP_ID  = import.meta.env.VITE_GROUP_ID || '9f282636-2d8c-4dc1-b600-b5fcfafa7d27';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('snap-canvas');
const picker      = document.getElementById('lens-picker');
const clearBtn    = document.getElementById('clear-lens');
const toggleBtn   = document.getElementById('ui-toggle');
const statusEl    = document.getElementById('status');

// ─── State ────────────────────────────────────────────────────────────────────
let session        = null;
let allLenses      = [];
let activeLensId   = null;
let pickerVisible  = true;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setStatus(msg) {
    statusEl.textContent = msg;
    statusEl.classList.remove('hidden');
}

function clearStatus() {
    statusEl.classList.add('hidden');
}

function setActiveThumb(lensId) {
    activeLensId = lensId;
    document.querySelectorAll('.lens-thumb').forEach(el => {
        el.classList.toggle('active', el.dataset.lensId === lensId);
    });
    clearBtn.classList.toggle('active', lensId === null);
}

function togglePicker(force) {
    pickerVisible = force !== undefined ? force : !pickerVisible;
    picker.classList.toggle('hidden', !pickerVisible);
    toggleBtn.classList.toggle('picker-hidden', !pickerVisible);
}

// ─── Build picker thumbnails ──────────────────────────────────────────────────
function buildPicker(lenses) {
    lenses.forEach((lens, i) => {
        const btn = document.createElement('button');
        btn.className = 'lens-thumb';
        btn.dataset.lensId = lens.id;
        btn.title = lens.name || `Lens ${i + 1}`;

        if (lens.iconUrl) {
            const img = document.createElement('img');
            img.src = lens.iconUrl;
            img.alt = lens.name || '';
            img.onerror = () => btn.replaceChildren(makeFallback(lens.name));
            btn.appendChild(img);
        } else {
            btn.appendChild(makeFallback(lens.name));
        }

        btn.addEventListener('click', () => applyLens(lens));
        picker.appendChild(btn);
    });
}

function makeFallback(name) {
    const wrap  = document.createElement('div');
    wrap.className = 'fallback';
    const icon  = document.createElement('span');
    icon.textContent = '✦';
    const label = document.createElement('small');
    label.textContent = name || 'Lens';
    wrap.append(icon, label);
    return wrap;
}

// ─── Apply / clear lens ───────────────────────────────────────────────────────
async function applyLens(lens) {
    if (!session) return;
    try {
        await session.applyLens(lens);
        setActiveThumb(lens.id);
        console.log('Applied lens:', lens.name, lens.id);
    } catch (err) {
        console.error('Failed to apply lens:', err);
    }
}

async function clearLens() {
    if (!session) return;
    try {
        await session.clearLens();
        setActiveThumb(null);
        console.log('Lens cleared');
    } catch (err) {
        console.error('Failed to clear lens:', err);
    }
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
// H          → toggle picker visibility (useful before switching to OBS)
// ArrowLeft  → previous lens
// ArrowRight → next lens
// Escape     → clear lens
document.addEventListener('keydown', async (e) => {
    if (e.key === 'h' || e.key === 'H') {
        togglePicker();
        return;
    }

    if (allLenses.length === 0) return;
    const idx = allLenses.findIndex(l => l.id === activeLensId);

    if (e.key === 'ArrowRight') {
        const next = (idx + 1) % allLenses.length;
        await applyLens(allLenses[next]);
    } else if (e.key === 'ArrowLeft') {
        const prev = (idx - 1 + allLenses.length) % allLenses.length;
        await applyLens(allLenses[prev]);
    } else if (e.key === 'Escape') {
        await clearLens();
    }
});

// ─── Main init ────────────────────────────────────────────────────────────────
async function init() {
    try {
        setStatus('Starting Camera Kit...');
        const cameraKit = await bootstrapCameraKit({ apiToken: API_TOKEN });
        console.log('Camera Kit ready');

        session = await cameraKit.createSession({ liveRenderTarget: canvas });
        console.log('Session created');

        // Camera
        setStatus('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const source = createMediaStreamSource(stream, {
            transform: Transform2D.MirrorX,
            cameraType: 'front',
        });
        await session.setSource(source);
        await session.play();
        console.log('Camera stream started');

        // Lenses
        setStatus('Loading lenses...');
        console.log('Fetching group:', GROUP_ID);

        const { lenses } = await cameraKit.lensRepository.loadLensGroups([GROUP_ID]);
        console.log('loadLensGroups response:', lenses);

        if (!lenses || lenses.length === 0) {
            setStatus(
                'Lens group found but no lenses came back.\n\n' +
                'Make sure your lenses are set to Available\n' +
                'in the Snap AR portal and are added to group:\n' +
                GROUP_ID
            );
            console.warn('No lenses returned for group:', GROUP_ID);
            return;
        }

        allLenses = lenses;
        console.log(`Found ${allLenses.length} lenses:`, allLenses.map(l => ({ id: l.id, name: l.name })));

        clearStatus();
        buildPicker(allLenses);

        // Apply the first lens automatically
        await applyLens(allLenses[0]);

    } catch (err) {
        console.error('Init error:', err);
        setStatus(`Error: ${err.message}\n\nCheck the browser console for details.`);
    }
}

// ─── UI wiring ────────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', clearLens);
toggleBtn.addEventListener('click', () => togglePicker());

// Consent gate — init only fires after the user accepts the privacy policy
const overlay  = document.getElementById('consent-overlay');
const consentBtn = document.getElementById('consent-btn');

consentBtn.addEventListener('click', () => {
    overlay.classList.add('fade-out');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    init();
});
