"""Receipt parsing pipeline package.

PDF flow:  pdfplumber_extract -> deterministic_parser -> (fallback) GLM structure_receipt
Image flow: GLM ocr_extract -> GLM structure_receipt

Both flows categorize items via app.categorizer and return a ParseResult.
"""
