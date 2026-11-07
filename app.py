import os
import hashlib

from flask import Flask, jsonify, render_template, request
from dotenv import load_dotenv

from services.pdf_service import extract_text_from_pdf
from services.ai_service import LakhesloAI


# Load environment variables from .env
load_dotenv()

app = Flask(__name__)

# Maximum uploaded PDF size: 20 MB
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

_document_cache = {}
_result_cache = {}
_ai_service = None


def get_ai_service():
    global _ai_service

    if _ai_service is None:
        _ai_service = LakhesloAI()

    return _ai_service


def get_document_text(pdf_bytes):
    cache_key = hashlib.sha256(pdf_bytes).hexdigest()

    if cache_key not in _document_cache:
        if len(_document_cache) >= 8:
            _document_cache.pop(next(iter(_document_cache)))
        _document_cache[cache_key] = extract_text_from_pdf(pdf_bytes)

    return _document_cache[cache_key]


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/process", methods=["POST"])
def process_document():

    # Check uploaded file
    if "file" not in request.files:
        return jsonify({"error": "Please upload a PDF document."}), 400

    uploaded_file = request.files["file"]

    if not uploaded_file.filename:
        return jsonify({"error": "No file was selected."}), 400

    if not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported."}), 400

    pdf_bytes = uploaded_file.read()

    if not pdf_bytes:
        return jsonify({"error": "The uploaded PDF is empty."}), 400

    # Identify requested feature
    mode = request.form.get("mode", "summarize")

    if mode not in ["summarize", "quiz", "chat"]:
        return jsonify({"error": "Invalid operation requested."}), 400

    try:
        # Reuse extracted text when a user asks multiple questions about one PDF.
        document_text = get_document_text(pdf_bytes)

        result_key = None
        if mode in ["summarize", "quiz"]:
            # Version the key so an older incomplete quiz is never reused.
            result_key = f"result-v2:{hashlib.sha256(pdf_bytes).hexdigest()}:{mode}"
            if result_key in _result_cache:
                return jsonify({
                    "success": True,
                    "mode": mode,
                    "result": _result_cache[result_key]
                })

        # Reuse the Gemini client between requests.
        ai = get_ai_service()

        # Execute requested feature
        if mode == "summarize":
            result = ai.summarize_document(document_text)

        elif mode == "quiz":
            result = ai.generate_quiz(document_text)

        else:
            question = request.form.get("question", "").strip()

            if not question:
                return jsonify({
                    "error": "Please enter a question about your document."
                }), 400

            if len(question) > 2000:
                return jsonify({
                    "error": "Your question is too long. Maximum 2,000 characters."
                }), 400

            result = ai.chat_with_document(document_text, question)

        if result_key:
            if len(_result_cache) >= 16:
                _result_cache.pop(next(iter(_result_cache)))
            _result_cache[result_key] = result

        return jsonify({
            "success": True,
            "mode": mode,
            "result": result
        })

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    except Exception as error:
        app.logger.exception("Document processing failed in %s mode.", mode)

        if "429" in str(error) or "RESOURCE_EXHAUSTED" in str(error):
            return jsonify({
                "error": (
                    "Gemini's daily free-tier limit has been reached. "
                    "Please try again after the quota resets, or enable billing "
                    "or use a project with available Gemini quota."
                )
            }), 429

        return jsonify({
            "error": (
                f"Lakheslo could not generate the {mode} result. "
                f"{str(error) or 'Please check your API configuration and try again.'}"
            )
        }), 500


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({
        "error": "The PDF is too large. Maximum file size is 20 MB."
    }), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
