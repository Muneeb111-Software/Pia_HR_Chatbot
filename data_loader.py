"""
PIA Chatbot - Data Loader
--------------------------
Reads the 5 source CSV files (kept SEPARATE on disk so new questions can be
added to each file independently), fixes known formatting issues, normalizes
everything into one consistent in-memory structure used by the search engine.

Known issues this fixes automatically, every time it loads:
1. leave.csv has a trailing comma on every data row, which shifts every
   column over by one. This function detects and repairs that shift.
2. Different files have different column names/order/extra columns
   (Question No., Reference, Authority / Reference). Normalized to:
   category, question, answer, keywords, reference, main_topic, source_file, id
3. Whitespace, smart quotes, and case are normalized for matching (a
   'search_blob' field is built), while original text is kept for display.
"""

import pandas as pd
import re
import os

SOURCE_DIR = os.path.join(os.path.dirname(__file__), "source_data")

FILES = {
    "leave.csv": "Leave",
    "leave_allowance.csv": None,   # mixed -> classified per-row below
    "medical.csv": "Medical",
    "allowances.csv": "Allowances",
    "recuritment.csv": "Recruitment",
    "pension.csv": "Pension",
    "passage.csv": "Passage",
    "descipline.csv": "Discipline",
}

LEAVE_CATEGORY_HINTS = {
    "lwp", "pl", "ssl", "lpr", "sick leave", "maternity", "casual leave",
    "leave general", "special leave", "accident leave", "quarantine leave",
    "days off",
}


def _clean_text(x):
    if pd.isna(x):
        return ""
    s = str(x).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def _normalize_for_search(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _fix_leave_csv(path):
    """
    leave.csv's data rows have one extra trailing comma vs. the header,
    which makes pandas silently treat the true Category value as the row
    INDEX and shifts Category<-Question, Question<-Answer, Answer<-Keywords.
    We detect this (index name un-set / extra column) and correct it.
    """
    df = pd.read_csv(path, encoding="utf-8-sig")
    if df.index.name is None and list(df.columns) == ["Category", "Question", "Answer", "Keywords"]:
        # Check whether a shift actually happened: real category values are
        # short leave-type labels, not full questions ending in '?'.
        sample = str(df["Category"].iloc[0])
        if sample.strip().endswith("?"):
            # Shift confirmed: true category is in the row index.
            fixed = pd.DataFrame({
                "Category": df.index.astype(str),
                "Question": df["Category"],
                "Answer": df["Question"],
                "Keywords": df["Answer"],
            })
            return fixed
    return df


def _classify_leave_allowance_row(category, question, answer):
    text = f"{question} {answer}".lower()
    cat_lower = str(category).lower()
    if "allowance" in text and "leave" not in cat_lower:
        return "Allowances"
    if cat_lower in LEAVE_CATEGORY_HINTS or "leave" in text:
        return "Leave"
    if "allowance" in text:
        return "Allowances"
    return "Allowances"  # default for this file: mostly crew pay/allowance FAQs


def load_all():
    records = []
    rid = 0
    for fname, fixed_topic in FILES.items():
        path = os.path.join(SOURCE_DIR, fname)
        if not os.path.exists(path):
            continue

        if fname == "leave.csv":
            df = _fix_leave_csv(path)
        else:
            df = pd.read_csv(path, encoding="utf-8-sig")

        for _, row in df.iterrows():
            category = _clean_text(row.get("Category", "General"))
            question = _clean_text(row.get("Question", ""))
            answer = _clean_text(row.get("Answer", ""))
            keywords = _clean_text(row.get("Keywords", ""))
            reference = _clean_text(row.get("Reference", row.get("Authority / Reference", "")))

            if not question or not answer:
                continue

            main_topic = fixed_topic or _classify_leave_allowance_row(category, question, answer)

            search_blob = _normalize_for_search(
                f"{question} {keywords} {category}"
            )

            records.append({
                "id": rid,
                "category": category,
                "question": question,
                "answer": answer,
                "keywords": keywords,
                "reference": reference,
                "main_topic": main_topic,
                "source_file": fname,
                "search_blob": search_blob,
                "question_norm": _normalize_for_search(question),
            })
            rid += 1

    return records


def dedupe(records):
    """Drop exact duplicate questions (same normalized question + topic)."""
    seen = set()
    out = []
    for r in records:
        key = (r["main_topic"], r["question_norm"])
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


if __name__ == "__main__":
    recs = load_all()
    print(f"Loaded {len(recs)} raw records")
    deduped = dedupe(recs)
    print(f"After dedupe: {len(deduped)} records")
    from collections import Counter
    print(Counter(r["main_topic"] for r in deduped))