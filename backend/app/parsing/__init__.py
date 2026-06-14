"""Receipt parsing pipeline package.

PDF flow:   GLM ocr_extract -> GLM structure_receipt (glm-4.7-flash)
Image flow: GLM ocr_extract -> GLM structure_receipt (glm-4.7-flash)

Both flows categorize items via app.categorizer and return a ParseResult.
"""
