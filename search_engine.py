"""
PIA Chatbot - Hybrid Search Engine
-----------------------------------
Combines three signals so that typos, casing, word-order changes, and
partial phrasing all still find the right answer:

1. TF-IDF cosine similarity   -> catches word-overlap / rephrasing / partial matches
2. difflib fuzzy ratio        -> catches typos and small spelling mistakes
3. keyword / category boost   -> catches exact keyword hits and topic filtering

Final score = weighted blend of all three. This needs no model downloads,
so it works fully offline and deploys anywhere Flask does.
"""

import re
import difflib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from data_loader import load_all, dedupe, _normalize_for_search


class SearchEngine:
    def __init__(self):
        self.records = dedupe(load_all())
        self._build_index()

    def _build_index(self):
        corpus = [r["search_blob"] for r in self.records]
        # char n-grams (3-5) make TF-IDF itself typo-tolerant, on top of
        # ordinary word tokens for topic/word-overlap matching.
        self.vectorizer = TfidfVectorizer(
            analyzer="char_wb", ngram_range=(3, 5), min_df=1
        )
        self.tfidf_matrix = self.vectorizer.fit_transform(corpus)

    def _fuzzy_ratio(self, a, b):
        return difflib.SequenceMatcher(None, a, b).ratio()

    def search(self, query, main_topic=None, top_k=5, min_score=0.38):
        if not query or not query.strip():
            return []

        norm_query = _normalize_for_search(query)
        query_vec = self.vectorizer.transform([norm_query])
        tfidf_scores = cosine_similarity(query_vec, self.tfidf_matrix)[0]

        query_words = set(norm_query.split())

        results = []
        for i, rec in enumerate(self.records):
            if main_topic and rec["main_topic"] != main_topic:
                continue

            tfidf_score = tfidf_scores[i]

            # Fuzzy ratio against the question itself (typo tolerance)
            fuzzy_score = self._fuzzy_ratio(norm_query, rec["question_norm"])

            # Keyword overlap boost: how many query words appear in
            # keywords/question/category verbatim
            kw_text = rec["search_blob"]
            kw_words = set(kw_text.split())
            overlap = len(query_words & kw_words)
            overlap_score = overlap / max(len(query_words), 1)

            combined = (
                0.5 * tfidf_score +
                0.3 * fuzzy_score +
                0.2 * overlap_score
            )

            if combined >= min_score:
                results.append((combined, rec))

        results.sort(key=lambda x: x[0], reverse=True)
        top = results[:top_k]
        return [
            {
                "id": rec["id"],
                "category": rec["category"],
                "main_topic": rec["main_topic"],
                "question": rec["question"],
                "answer": rec["answer"],
                "reference": rec["reference"],
                "score": round(float(score), 3),
            }
            for score, rec in top
        ]

    def get_categories(self):
        topics = {}
        for r in self.records:
            topics.setdefault(r["main_topic"], set()).add(r["category"])
        return {k: sorted(v) for k, v in topics.items()}

    def get_topic_counts(self):
        counts = {}
        for r in self.records:
            counts[r["main_topic"]] = counts.get(r["main_topic"], 0) + 1
        return counts

    def get_faqs(self, main_topic=None, limit=8):
        """Featured FAQs: for now, first N per topic (curated order from
        source files). Swap this out later for real click/analytics data."""
        pool = self.records
        if main_topic:
            pool = [r for r in pool if r["main_topic"] == main_topic]
        return [
            {
                "id": r["id"],
                "category": r["category"],
                "main_topic": r["main_topic"],
                "question": r["question"],
                "answer": r["answer"],
            }
            for r in pool[:limit]
        ]

    def get_by_category(self, category, limit=50):
        pool = [r for r in self.records if r["category"].lower() == category.lower()]
        return [
            {
                "id": r["id"], "category": r["category"], "main_topic": r["main_topic"],
                "question": r["question"], "answer": r["answer"],
            }
            for r in pool[:limit]
        ]


if __name__ == "__main__":
    engine = SearchEngine()
    tests = [
        "how many casual leave days do i get",   # exact, lowercase
        "HOW MANY CASUAL LEAVE DAYS DO I GET",    # all caps
        "how many casul leve days i get",         # typos
        "carry forward casual leave",
        "medical outdoor treatment",
        "what is house rent allowance",
        "recruitment personal qualities candidates",
    ]
    for t in tests:
        print(f"\nQUERY: {t}")
        for r in engine.search(t, top_k=2):
            print(f"  [{r['score']}] ({r['main_topic']}) {r['question']}")
            print(f"      -> {r['answer'][:90]}")
