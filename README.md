# Barcode Studio

A GitHub Pages-friendly web app to:
- Generate scannable 1D and 2D barcodes (QR, Data Matrix, PDF417, Code128, EAN-13, etc.)
- Scan codes with your camera (browser-based)
- Optional: write/read NFC tags (Web NFC, limited availability)

## Run locally
Use a simple local server:
```bash
python -m http.server 8000
```
Open: http://localhost:8000

## Deploy to GitHub Pages
1. Create a GitHub repo (e.g. barcode-studio)
2. Upload these files
3. Repo Settings → Pages → Deploy from branch → main → /(root)
