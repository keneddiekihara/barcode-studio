import bwipjs from 'https://cdn.jsdelivr.net/npm/@bwip-js/browser@4.8.0/dist/bwip-js.mjs';

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

if (!$('text').value) $('text').value = 'INV-00012345';
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
