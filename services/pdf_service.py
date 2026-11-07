import pymupdf

def extract_text_from_pdf(pdf_bytes):
    """
    Extract text from an uploaded PDF document.

    Args:
        pdf_bytes: PDF file content in bytes.

    Returns:
        Extracted text from all pages.
    """

    if not pdf_bytes:
        raise ValueError("The uploaded PDF is empty.")

    try:
        document = pymupdf.open(
            stream=pdf_bytes,
            filetype="pdf"
        )

        if document.is_encrypted:
            document.close()
            raise ValueError("Password-protected PDFs are not supported.")

        extracted_pages = []

        for page_number, page in enumerate(document, start=1):
            page_text = page.get_text("text")

            if page_text.strip():
                extracted_pages.append(
                    f"--- Page {page_number} ---\n{page_text}"
                )

        document.close()

        full_text = "\n\n".join(extracted_pages).strip()

        if not full_text:
            raise ValueError(
                "No readable text was found in this PDF. "
                "It may contain scanned images instead of selectable text."
            )

        return full_text

    except ValueError:
        raise

    except Exception as error:
        raise ValueError(
            "Unable to read this PDF. Please upload a valid PDF document."
        ) from error