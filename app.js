import bwipjs from 'https://cdn.jsdelivr.net/npm/@bwip-js/browser@4.8.0/dist/bwip-js.mjs';

// --- Sample payloads (fake data for testing) ---
const SAMPLE_US_VCARD = `BEGIN:VCARD
VERSION:3.0
N:Doe;Jane;;;
FN:Jane Doe
ORG:Acme Research Lab
TITLE:Data Coordinator
TEL;TYPE=CELL:+1-202-555-0147
EMAIL:jane.doe@example.com
ADR;TYPE=HOME:;;1600 Pennsylvania Ave NW;Washington;DC;20500;USA
URL:https://example.com
NOTE:Sample test profile (not an official ID).
END:VCARD`;

const SAMPLE_US_JSON = JSON.stringify({
  profile_type: "test_profile",
  person: { first_name: "Jane", last_name: "Doe" },
  contact: { phone: "+1-202-555-0147", email: "jane.doe@example.com" },
  address: { line1: "1600 Pennsylvania Ave NW", city: "Washington", state: "DC", zip: "20500", country: "USA" },
  identifiers: { internal_id: "USR-000001", membership: "STANDARD" },
  created_at: new Date().toISOString()
}, null, 2);

const SAMPLE_URL = "https://example.com/item/INV-00012345";

const $ = (id) => document.getElementById(id);

// Tabs
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
tabs.forEach(t => t.addEventListener('click', (e) => {
  e.preventDefault();
  const name = t.dataset.tab;
  tabs.forEach(x => x.classList.toggle('active', x.dataset.tab === name));
  panels.forEach(p => p.classList.toggle('active', p.id === name));
  history.replaceState(null, '', '#' + name);
}));

const initial = (location.hash || '#generate').replace('#','');
document.querySelector(`.tab[data-tab="${initial}"]`)?.click();

// Generator
const canvas = $('canvas');
const svgPreview = $('svg-preview');
const genStatus = $('gen-status');

function is2D(bcid) {
  return ['qrcode', 'datamatrix', 'pdf417', 'azteccode'].includes(bcid);
}

function buildOptions() {
  const bcid = $('bcid').value;
  const text = $('text').value.trim();
  const scale = Number($('scale').value || 3);
  const height = Number($('height').value || 10);
  const includetext = $('includetext').checked;
  const showborder = $('showborder').checked;

  const opts = { bcid, text, scale: Math.max(1, Math.min(10, scale)) };

  if (!is2D(bcid)) {
    opts.height = Math.max(5, Math.min(30, height));
    opts.includetext = includetext;
    opts.textxalign = 'center';
  } else {
    if (showborder) opts.padding = 12;
  }

  return opts;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fileName(bcid, ext) {
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  return `${bcid}-${ts}.${ext}`;
}

function renderCanvas() {
  genStatus.textContent = '';
  svgPreview.hidden = true;
  canvas.hidden = false;

  const opts = buildOptions();
  if (!opts.text) {
    genStatus.textContent = 'Please enter text/data to encode.';
    return;
  }

  try {
    bwipjs.toCanvas(canvas, opts);
    genStatus.textContent = 'Generated successfully.';
  } catch (e) {
    genStatus.textContent = 'Error: ' + (e?.message || e);
  }
}

function renderSVGAndDownload() {
  genStatus.textContent = '';
  const opts = buildOptions();
  if (!opts.text) {
    genStatus.textContent = 'Please enter text/data to encode.';
    return;
  }

  try {
    const svg = bwipjs.toSVG(opts);
    svgPreview.innerHTML = svg;
    svgPreview.hidden = false;
    canvas.hidden = true;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, fileName(opts.bcid, 'svg'));
    genStatus.textContent = 'SVG downloaded.';
  } catch (e) {
    genStatus.textContent = 'Error: ' + (e?.message || e);
  }
}

function downloadPNG() {
  try {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName($('bcid').value, 'png');
    document.body.appendChild(a);
    a.click();
    a.remove();
    genStatus.textContent = 'PNG downloaded.';
  } catch (e) {
    genStatus.textContent = 'Error: ' + (e?.message || e);
  }
}

$('btn-generate').addEventListener('click', renderCanvas);
$('btn-svg').addEventListener('click', renderSVGAndDownload);
$('btn-png').addEventListener('click', downloadPNG);

if (!$('text').value) { $('bcid').value = 'qrcode'; $('text').value = SAMPLE_US_VCARD; $('showborder').checked = true; }
renderCanvas();

// Scanner
const scanStatus = $('scan-status');
const scanResult = $('scan-result');
const btnStart = $('btn-start');
const btnStop = $('btn-stop');
const cameraSel = $('camera');
const video = $('video');

let controls = null;

async function listCameras() {
  cameraSel.innerHTML = '';
  scanStatus.textContent = 'Loading cameras...';

  try {
    const devices = await ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
    if (!devices.length) {
      scanStatus.textContent = 'No cameras found.';
      return;
    }
    for (const d of devices) {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camera ${cameraSel.options.length + 1}`;
      cameraSel.appendChild(opt);
    }
    scanStatus.textContent = 'Select a camera and click Start scanning.';
  } catch (e) {
    scanStatus.textContent = 'Camera error: ' + (e?.message || e);
  }
}

async function startScan() {
  scanResult.value = '';
  scanStatus.textContent = 'Starting...';

  const deviceId = cameraSel.value || null;

  try {
    const reader = new ZXingBrowser.BrowserMultiFormatReader();
    btnStart.disabled = true;
    btnStop.disabled = false;

    controls = await reader.decodeFromVideoDevice(deviceId, video, (result, err) => {
      if (result) {
        scanResult.value = result.getText();
        scanResult.dispatchEvent(new Event('input'));
        scanStatus.textContent = 'Decoded.';
      } else if (err && err.name !== 'NotFoundException') {
        scanStatus.textContent = 'Scan error: ' + (err?.message || err);
      }
    });

    scanStatus.textContent = 'Scanning... point camera at the barcode.';
  } catch (e) {
    btnStart.disabled = false;
    btnStop.disabled = true;
    scanStatus.textContent = 'Start error: ' + (e?.message || e);
  }
}

function stopScan() {
  if (controls) controls.stop();
  controls = null;
  btnStart.disabled = false;
  btnStop.disabled = true;
  scanStatus.textContent = 'Stopped.';
}

btnStart.addEventListener('click', startScan);
btnStop.addEventListener('click', stopScan);

$('btn-copy').addEventListener('click', async () => {
  const val = scanResult.value.trim();
  if (!val) return;
  await navigator.clipboard.writeText(val);
  scanStatus.textContent = 'Copied to clipboard.';
});

$('btn-clear').addEventListener('click', () => {
  scanResult.value = '';
  scanStatus.textContent = '';
});

// NFC (optional)
const nfcStatus = $('nfc-status');
const nfcResult = $('nfc-result');

$('btn-nfc-write').addEventListener('click', async () => {
  nfcStatus.textContent = '';
  nfcResult.value = '';

  if (!('NDEFReader' in window)) {
    nfcStatus.textContent = 'Web NFC is not available on this browser/device.';
    return;
  }
  const text = $('ndef-text').value.trim();
  if (!text) {
    nfcStatus.textContent = 'Enter some text or a URL to write.';
    return;
  }

  try {
    const ndef = new NDEFReader();
    await ndef.write({ records: [{ recordType: 'text', data: text }] });
    nfcStatus.textContent = 'Written! Tap another tag to write again.';
  } catch (e) {
    nfcStatus.textContent = 'NFC write error: ' + (e?.message || e);
  }
});

$('btn-nfc-read').addEventListener('click', async () => {
  nfcStatus.textContent = '';
  nfcResult.value = '';

  if (!('NDEFReader' in window)) {
    nfcStatus.textContent = 'Web NFC is not available on this browser/device.';
    return;
  }

  try {
    const ndef = new NDEFReader();
    await ndef.scan();
    nfcStatus.textContent = 'Tap an NFC tag to read...';

    ndef.addEventListener('reading', ({ message }) => {
      const lines = [];
      for (const record of message.records) {
        lines.push(`${record.recordType}: ${record.data ?? ''}`);
      }
      nfcResult.value = lines.join('\n');
      nfcStatus.textContent = 'Read complete.';
    });
  } catch (e) {
    nfcStatus.textContent = 'NFC read error: ' + (e?.message || e);
  }
});

document.querySelector('.tab[data-tab="scan"]').addEventListener('click', listCameras);

// Sample loaders (added)


/* Secure Signed QR -------------------------------------------------------
   Token format (JWS-like): base64url(header).base64url(payload).base64url(signature)
   - header: { alg: "ES256", typ: "BST" }
   - payload: { v, iss, type, id, name?, iat, exp? }
   - signature: ECDSA P-256 with SHA-256 (ES256)
   Verifiers need only the PUBLIC key.
------------------------------------------------------------------------- */

const secureStatus = $('secure-status');
const tokenOut = $('token');
const verifyStatus = $('verify-status');
const verifyPayload = $('verify-payload');
const pubkeyView = $('pubkey-view');
const tokenInput = $('token-input');

function b64uEncode(bytes) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return b64;
}
function b64uDecode(str) {
  const pad = str.length % 4 === 2 ? '==' : str.length % 4 === 3 ? '=' : str.length % 4 === 1 ? '===' : '';
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function utf8Encode(s) { return new TextEncoder().encode(s); }
function utf8Decode(bytes) { return new TextDecoder().decode(bytes); }

const LS_PRIV = 'bs_priv_jwk_v1';
const LS_PUB = 'bs_pub_jwk_v1';
const LS_ISS = 'bs_issuer_v1';

let privKey = null;
let pubKey = null;

async function loadKeysFromStorage() {
  try {
    const issuer = localStorage.getItem(LS_ISS);
    if (issuer && $('issuer')) $('issuer').value = issuer;

    const privJwk = localStorage.getItem(LS_PRIV);
    const pubJwk = localStorage.getItem(LS_PUB);
    if (pubJwk) pubkeyView.value = pubJwk;

    if (privJwk && pubJwk && crypto?.subtle) {
      privKey = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(privJwk),
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
      );
      pubKey = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(pubJwk),
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );
      setStatus(secureStatus, 'Key pair loaded (local).', true);
    }
  } catch (e) {
    setStatus(secureStatus, 'Key load error: ' + (e?.message || e), false);
  }
}

function setStatus(el, msg, ok) {
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('ok', !!ok);
  el.classList.toggle('bad', !ok);
}

async function generateKeyPair() {
  if (!crypto?.subtle) {
    setStatus(secureStatus, 'WebCrypto not available in this browser.', false);
    return;
  }
  try {
    const kp = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    privKey = kp.privateKey;
    pubKey = kp.publicKey;

    const privJwk = await crypto.subtle.exportKey('jwk', privKey);
    const pubJwk = await crypto.subtle.exportKey('jwk', pubKey);

    localStorage.setItem(LS_PRIV, JSON.stringify(privJwk));
    localStorage.setItem(LS_PUB, JSON.stringify(pubJwk));
    pubkeyView.value = JSON.stringify(pubJwk);

    setStatus(secureStatus, 'New key pair generated and saved locally.', true);
  } catch (e) {
    setStatus(secureStatus, 'Key generation error: ' + (e?.message || e), false);
  }
}

async function exportPublicKey() {
  const pubJwk = localStorage.getItem(LS_PUB);
  if (!pubJwk) { setStatus(secureStatus, 'No public key found. Generate a key pair first.', false); return; }
  downloadText(pubJwk, 'barcode-studio-public-key.json');
  setStatus(secureStatus, 'Public key downloaded.', true);
}

async function exportKeyPair() {
  const privJwk = localStorage.getItem(LS_PRIV);
  const pubJwk = localStorage.getItem(LS_PUB);
  if (!privJwk || !pubJwk) { setStatus(secureStatus, 'No key pair found. Generate one first.', false); return; }
  const bundle = JSON.stringify({ priv: JSON.parse(privJwk), pub: JSON.parse(pubJwk) }, null, 2);
  downloadText(bundle, 'barcode-studio-keypair.json');
  setStatus(secureStatus, 'Key pair downloaded. Keep the private key secret.', true);
}

async function importKeyPairFromFile(onlyPublic=false) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);

      if (onlyPublic) {
        const pub = obj.pub ? obj.pub : obj; // allow either bundle or plain pub jwk
        localStorage.setItem(LS_PUB, JSON.stringify(pub));
        pubkeyView.value = JSON.stringify(pub);
        pubKey = await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
        setStatus(verifyStatus, 'Public key imported.', true);
        return;
      }

      if (!obj.priv || !obj.pub) throw new Error('Expected { priv, pub } JSON.');
      localStorage.setItem(LS_PRIV, JSON.stringify(obj.priv));
      localStorage.setItem(LS_PUB, JSON.stringify(obj.pub));
      pubkeyView.value = JSON.stringify(obj.pub);

      privKey = await crypto.subtle.importKey('jwk', obj.priv, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
      pubKey = await crypto.subtle.importKey('jwk', obj.pub, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);

      setStatus(secureStatus, 'Key pair imported and saved locally.', true);
    } catch (e) {
      setStatus(secureStatus, 'Import error: ' + (e?.message || e), false);
    }
  };
  input.click();
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function signToken(payloadObj) {
  if (!privKey) throw new Error('No private key. Generate/import key pair first.');
  const header = { alg: 'ES256', typ: 'BST' };
  const h = b64uEncode(utf8Encode(JSON.stringify(header)));
  const p = b64uEncode(utf8Encode(JSON.stringify(payloadObj)));
  const toSign = utf8Encode(`${h}.${p}`);

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    toSign
  );

  const s = b64uEncode(sig);
  return `${h}.${p}.${s}`;
}

async function verifyToken(token) {
  if (!pubKey) throw new Error('No public key loaded. Import public key or generate a key pair.');
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('Not a signed token.');
  const [h, p, s] = parts;

  const header = JSON.parse(utf8Decode(b64uDecode(h)));
  if (header.alg !== 'ES256') throw new Error('Unsupported alg.');

  const payload = JSON.parse(utf8Decode(b64uDecode(p)));
  const sigBytes = b64uDecode(s);
  const data = utf8Encode(`${h}.${p}`);

  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pubKey,
    sigBytes,
    data
  );
  return { ok, payload, header };
}

async function generateSignedQR() {
  secureStatus && setStatus(secureStatus, '', true);

  const issuer = $('issuer')?.value?.trim() || 'MyOrg';
  const type = $('cardtype')?.value || 'member';
  const id = $('uid')?.value?.trim();
  const name = $('displayname')?.value?.trim() || undefined;
  const exp = $('expires')?.value ? new Date($('expires').value + 'T00:00:00Z').toISOString() : undefined;

  if (!id) { setStatus(secureStatus, 'Unique ID is required.', false); return; }

  localStorage.setItem(LS_ISS, issuer);

  if (!crypto?.subtle) { setStatus(secureStatus, 'WebCrypto not available in this browser.', false); return; }
  if (!privKey || !pubKey) { setStatus(secureStatus, 'No key pair loaded. Click "Generate key pair" first.', false); return; }

  const now = new Date().toISOString();
  const payload = { v: 1, iss: issuer, type, id, iat: now };
  if (name) payload.name = name;
  if (exp) payload.exp = exp;

  try {
    const token = await signToken(payload);
    if (tokenOut) tokenOut.value = token;

    // Render as QR
    if ($('bcid')) $('bcid').value = 'qrcode';
    if ($('text')) $('text').value = token;
    if ($('showborder')) $('showborder').checked = true;
    renderCanvas();

    setStatus(secureStatus, 'Signed token generated and rendered as QR.', true);
  } catch (e) {
    setStatus(secureStatus, 'Signing error: ' + (e?.message || e), false);
  }
}

async function tryVerifyAndShow(token) {
  if (!token) return;
  try {
    const { ok, payload } = await verifyToken(token);
    if (ok) {
      setStatus(verifyStatus, 'VALID ✅ Signature verified.', true);
      verifyPayload.value = JSON.stringify(payload, null, 2);
    } else {
      setStatus(verifyStatus, 'INVALID ❌ Signature mismatch.', false);
      verifyPayload.value = '';
    }
  } catch (e) {
    setStatus(verifyStatus, (e?.message || e), false);
    verifyPayload.value = '';
  }
}

// Hook buttons (if present)
$('btn-keygen')?.addEventListener('click', generateKeyPair);
$('btn-export-public')?.addEventListener('click', exportPublicKey);
$('btn-export-keys')?.addEventListener('click', exportKeyPair);
$('btn-import-keys')?.addEventListener('click', () => importKeyPairFromFile(false));

$('btn-signed-qr')?.addEventListener('click', generateSignedQR);

$('btn-import-public')?.addEventListener('click', () => importKeyPairFromFile(true));
$('btn-clear-verify')?.addEventListener('click', () => {
  setStatus(verifyStatus, '', true);
  verifyPayload.value = '';
  tokenInput.value = '';
});

// Auto-verify when user pastes a token
tokenInput?.addEventListener('input', () => {
  const t = tokenInput.value.trim();
  if (t.length < 20) return;
  tryVerifyAndShow(t);
});

// Also auto-verify the scan result if it looks like a token
const originalDecodeCallbackNote = 'Decoded.';
const oldScanHandler = null; // placeholder to avoid lint in editors

// Patch into existing scan flow: after scanResult.value assignment, call verify
// (We do this by monkey-patching startScan's callback; easier: observe changes)
scanResult?.addEventListener('input', () => {
  const t = scanResult.value.trim();
  if (t.includes('.') && t.split('.').length === 3) {
    tryVerifyAndShow(t);
  }
});

// Update scan callback by wrapping decodeFromVideoDevice if present
// (If scan already running, user can stop/start to apply.)
(function patchScanCallback(){
  // If startScan exists in scope, we can patch by redefining it; but to keep minimal, we rely on input listener above.
})();

loadKeysFromStorage();
