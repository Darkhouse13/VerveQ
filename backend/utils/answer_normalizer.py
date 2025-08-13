import unicodedata
import re

"""
Utility function for normalizing answers for consistent comparison.
"""

def normalize_answer(answer_string: str) -> str:
    """
    Normalizes an answer string for robust comparison.
    Handles casing, whitespace, commas in numbers, and common score separators.
    """
    if not isinstance(answer_string, str):
        answer_string = str(answer_string)

    # 1. Unicode Normalization (NFKC form)
    normalized = unicodedata.normalize('NFKC', answer_string)

    # 2. Convert to lowercase and strip leading/trailing whitespace
    normalized = normalized.lower().strip()

    # 3. Remove currency symbols
    normalized = normalized.replace("€", "").replace("$", "").replace("£", "")

    # 4. Remove percentage signs
    normalized = normalized.replace("%", "")

    # 5. Handle "M" (million) and "K" (thousand) suffixes
    if normalized.endswith("m"):
        normalized = normalized.replace("m", "")
        if "." in normalized:
            try:
                value = float(normalized) * 1_000_000
                normalized = str(int(value))
            except ValueError:
                pass
        else:
            normalized += "000000"
    elif normalized.endswith("k"):
        normalized = normalized.replace("k", "")
        if "." in normalized:
            try:
                value = float(normalized) * 1_000
                normalized = str(int(value))
            except ValueError:
                pass
        else:
            normalized += "000"

    # 6. Remove commas from numbers (e.g., "75,000" -> "75000")
    normalized = normalized.replace(",", "")

    # 7. Standardize score separators (e.g., "3 - 2" -> "3-2", "3:2" -> "3-2")
    normalized = normalized.replace(" - ", "-")
    normalized = normalized.replace(" : ", "-")
    
    # 8. Remove any characters that are not alphanumeric, hyphens, or apostrophes
    # This is crucial for cleaning up invisible characters or unexpected symbols in names.
    # We need to be careful not to remove essential punctuation for names (e.g., O'Malley, Saint-Maximin)
    # For now, let's allow alphanumeric, hyphens, and apostrophes.
    # This regex will remove anything else.
    normalized = re.sub(r"[^a-z0-9\-']", "", normalized)

    # 9. Remove all spaces (after standardizing separators)
    # This is a more aggressive step for names and phrases to ensure exact match
    normalized = normalized.replace(" ", "")

    return normalized