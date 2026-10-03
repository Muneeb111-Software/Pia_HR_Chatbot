# PIA HR Assistant

A Flask-based FAQ chatbot for PIA employees, covering **Leave, Medical,
Allowances, and Recruitment** policies — 1,268 Q&A pairs.

## Quick start

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

## What was fixed from your original files

1. **`leave.csv` had a column-shift bug.** Every data row had a stray
   trailing comma, which shifted every column over by one (Category held
   Question text, Question held Answer text, etc). `data_loader.py`
   detects and repairs this automatically every time it loads — you don't
   need to manually edit `leave.csv`, but it's worth cleaning up next time
   you edit that file in Excel (just make sure each row has exactly 4
   comma-separated fields, no trailing comma).
2. **Inconsistent columns across files** (`Question No.`, `Reference`,
   `Authority / Reference` in different places) are normalized into one
   consistent internal structure.
3. **No text normalization** was happening before — that's why casing and
   small typos broke matching. Every question is now matched using a
   hybrid of TF-IDF (word/phrase overlap), fuzzy string matching (typo
   tolerance), and keyword overlap — combined into one confidence score.
4. **1,316 raw rows → 1,268 after removing exact duplicates** (matches
   your count of ~1,267).

## Adding new questions

Your 5 CSV files stay **separate** on purpose, exactly as you wanted, so
you can keep adding rows to whichever file makes sense:

- `source_data/leave.csv`
- `source_data/leave_allowance.csv`
- `source_data/medical.csv`
- `source_data/allowances.csv`
- `source_data/recuritment.csv`

Just keep the same columns (`Category, Question, Answer, Keywords`, plus
`Reference` for medical.csv). **Do not add a trailing comma at the end of
a data row** — that's what caused the leave.csv bug. New rows are picked
up automatically the next time the Flask app restarts (no re-ingestion
script needed).

## How search works (`search_engine.py`)

For every query, each candidate Q&A is scored as:

```
score = 0.5 × TF-IDF similarity   (word/phrase overlap, handles rephrasing)
      + 0.3 × fuzzy ratio          (handles typos/misspellings)
      + 0.2 × keyword overlap      (handles exact keyword hits)
```

Matches below a confidence threshold (0.38) are treated as "not found"
rather than returning a wrong/irrelevant answer — this was tuned against
test queries including deliberate typos and off-topic questions.

This approach needs **no model downloads** and works fully offline,
which makes it easy to deploy anywhere. If you later want smarter
semantic search (e.g. understanding "time off" means the same as
"leave"), the `ingest.py` you already had (ChromaDB + sentence
embeddings) is a good next step — happy to wire that in as an upgrade.

## Project structure

```
pia_chatbot/
├── app.py                 # Flask routes + API endpoints
├── data_loader.py          # Reads & fixes the 5 CSVs
├── search_engine.py         # Hybrid search scoring
├── source_data/             # Your 5 CSV files (edit these to add Qs)
├── templates/index.html      # Main page
├── static/css/style.css       # Styling & animations
├── static/js/script.js         # Search, FAQ grid, topic filtering
└── requirements.txt
```

## API endpoints

- `GET  /api/search?q=...&topic=Leave&top_k=5` — ranked list of matches
- `POST /api/ask` — body `{"message": "...", "topic": "Leave"}` → best answer + related
- `GET  /api/faqs?topic=Medical&limit=8` — featured FAQs
- `GET  /api/categories` — topic → category list
- `GET  /api/category/<name>` — all Q&A in one category

## Deploying

For production, don't use `python app.py` (Flask's dev server). Use
Gunicorn instead:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```
