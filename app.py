"""
PIA HR Assistant - Flask Backend
----------------------------------
API + server for the PIA employee FAQ chatbot covering Leave, Medical,
Allowances, and Recruitment policies.
"""

from flask import Flask, render_template, request, jsonify
from search_engine import SearchEngine
import os
print("APP.PY IS RUNNING FROM:", os.path.abspath(__file__))
app = Flask(__name__)
engine = SearchEngine()
print("READING TEMPLATE FROM:", os.path.abspath(os.path.join(app.template_folder or "templates", "index.html")))
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "index.html"), encoding="utf-8") as f:
    print("CONTAINS 'Pension'?", "Pension" in f.read())

TOPIC_META = {
    "Leave": {"icon_char": "\u2708", "color": "#22C58B", "desc": "Casual, sick, maternity & other leave policies"},
    "Medical": {"icon_char": "\u271A", "color": "#5CC8FF", "desc": "Outdoor/indoor treatment, hospitalization & medical board"},
    "Allowances": {"icon_char": "\u2707", "color": "#D4AF37", "desc": "House rent, conveyance, crew & special allowances"},
    "Recruitment": {"icon_char": "\u2691", "color": "#F0715A", "desc": "Hiring policy, interviews & appointment procedures"},
    "Pension": {"icon_char": "\u2695", "color": "#8E6FCE", "desc": "Pension fund, gratuity & retirement terminal benefits"},
    "Passage": {"icon_char": "\u2708", "color": "#2FBFA6", "desc": "Rebated tickets & employee travel concession policy"},
    "Discipline": {"icon_char": "\u2696", "color": "#6B7A8F", "desc": "Conduct rules, disciplinary action & appeals procedure"},
}


@app.route("/")
def index():
    counts = engine.get_topic_counts()
    topics = []
    for name, meta in TOPIC_META.items():
        topics.append({
            
            "name": name,
            "count": counts.get(name, 0),
            **meta
        })
    total = sum(counts.values())
    return render_template("index.html", topics=topics, total=total)


@app.route("/api/search")
def api_search():
    query = request.args.get("q", "")
    topic = request.args.get("topic") or None
    top_k = int(request.args.get("top_k", 5))
    results = engine.search(query, main_topic=topic, top_k=top_k)
    return jsonify({"query": query, "results": results, "count": len(results)})


@app.route("/api/ask", methods=["POST"])
def api_ask():
    """Chat-style endpoint: returns the best single answer + related suggestions."""
    data = request.get_json(force=True) or {}
    query = data.get("message", "")
    topic = data.get("topic") or None

    results = engine.search(query, main_topic=topic, top_k=4)

    if not results:
        return jsonify({
            "answer": "I couldn't find a confident match for that in the Leave, Medical, "
                      "Allowances, or Recruitment policies. Could you try rephrasing, or "
                      "pick a topic below to browse related FAQs?",
            "matched_question": None,
            "confidence": 0,
            "category": None,
            "main_topic": None,
            "related": [],
        })

    best = results[0]
    related = results[1:4]
    return jsonify({
        "answer": best["answer"],
        "matched_question": best["question"],
        "confidence": best["score"],
        "category": best["category"],
        "main_topic": best["main_topic"],
        "reference": best.get("reference", ""),
        "related": related,
    })


@app.route("/api/categories")
def api_categories():
    return jsonify(engine.get_categories())


@app.route("/api/faqs")
def api_faqs():
    topic = request.args.get("topic") or None
    limit = int(request.args.get("limit", 8))
    return jsonify(engine.get_faqs(main_topic=topic, limit=limit))


@app.route("/api/category/<path:category>")
def api_by_category(category):
    return jsonify(engine.get_by_category(category))


if __name__ == "__main__":
    print("Loaded", len(engine.records), "Q&A pairs")
    app.run(debug=True, host="0.0.0.0", port=5051)