import os
from google import genai
from google.genai import types


class LakhesloAI:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY is missing. Please configure it in your .env file."
            )

        self.client = genai.Client(api_key=api_key)
        self.model = "gemini-3.8-flash"

    def _generate(self, prompt, max_output_tokens=5000, temperature=0.4):
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens
            )
        )

        if not response.text:
            raise RuntimeError("Gemini returned an empty response.")

        return response.text.strip()

    def summarize_document(self, document_text):
        prompt = f"""
You are Lakheslo, an academic study assistant. Summarize the document below
accurately and concisely.

Use this format:
Overview: 2-3 sentences.
Key points:
- The most important facts and concepts.
- Important definitions, examples, or conclusions.

Use only information from the document. Do not invent facts. Keep the summary
focused and easy to study; do not repeat points.

DOCUMENT:
{document_text}
"""
        return self._generate(prompt, max_output_tokens=1600, temperature=0.2)

    def generate_quiz(self, document_text):
        prompt = f"""
You are Lakheslo, an academic quiz generator.

Generate exactly 10 complete multiple-choice questions based ONLY on the
following document.

Requirements:
1. Number every question from 1 through 10.
2. Each question must have 4 options (A, B, C, D).
3. Include the correct answer after each question.
4. Add a short explanation for the correct answer.
5. Cover different topics from the document.
6. Avoid questions requiring information outside the document.
7. Keep each explanation to one sentence.
8. Use this exact format for every question:

Question N: [question]
A) [option]
B) [option]
C) [option]
D) [option]
Correct Answer: [letter]
Explanation: [one sentence]

Before finishing, check that all 10 questions are present and that every
question has four options, a correct answer, and an explanation. Never stop
in the middle of a question.

DOCUMENT:
{document_text}
"""
        return self._generate(prompt, max_output_tokens=5000)

    def chat_with_document(self, document_text, question):
        prompt = f"""
You are Lakheslo, an academic assistant that answers questions
using the uploaded document.

Rules:
1. Answer using the document as your main source.
2. Explain your answer clearly and simply.
3. If the answer is not found in the document, say so honestly.
4. Do not invent facts or pretend the document contains information
   that it does not contain.
5. Answer directly and keep the response concise.

DOCUMENT:
{document_text}

USER QUESTION:
{question}
"""
        return self._generate(prompt, max_output_tokens=1200)
