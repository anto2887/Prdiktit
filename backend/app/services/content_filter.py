"""
Content filtering service for usernames
Detects profanity, slurs, and inappropriate content
"""
import json
import logging
import unicodedata
from pathlib import Path
from typing import Set

logger = logging.getLogger(__name__)


def _fold_accents(text: str) -> str:
    """Lowercase ASCII-ish form for matching (strips combining marks after NFD)."""
    if not text:
        return ""
    nfd = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


class ContentFilter:
    """
    Content filtering service for usernames
    Detects profanity, slurs, and inappropriate content
    """

    def __init__(self):
        """Initialize the content filter with word list"""
        self.profanity_words: Set[str] = set()
        self.whitelist: Set[str] = {
            "class", "assist", "pass", "grass", "glass", "mass", "bass",
            "cass", "sass", "brass", "crass", "compass", "surpass",
            "harass", "embarrass", "bypass", "overpass", "underpass"
        }

        # Obfuscation character mappings
        self.obfuscation_map = {
            '@': 'a',
            '4': 'a',
            '3': 'e',
            '1': 'i',
            '!': 'i',
            '0': 'o',
            '5': 's',
            '$': 's',
            '7': 't',
            '+': 't',
            '8': 'b',
            '9': 'g',
        }

        self._load_profanity_list()

    def _load_profanity_list(self):
        """Load profanity lists from utils/profanity/*.json and merge."""
        current_dir = Path(__file__).parent.parent
        profanity_dir = current_dir / "utils" / "profanity"

        if not profanity_dir.is_dir():
            logger.warning(f"Profanity directory not found at {profanity_dir}")
            return

        json_files = sorted(profanity_dir.glob("*.json"))
        if not json_files:
            logger.warning(f"No JSON word lists in {profanity_dir}")
            return

        merged: Set[str] = set()
        for words_file in json_files:
            try:
                with open(words_file, "r", encoding="utf-8") as f:
                    words = json.load(f)
                if not isinstance(words, list):
                    logger.error(f"Profanity file {words_file.name} must be a JSON array; skipped")
                    continue
                count_before = len(merged)
                for w in words:
                    if not w or not isinstance(w, str):
                        continue
                    folded = _fold_accents(w.strip())
                    if folded:
                        merged.add(folded)
                added = len(merged) - count_before
                logger.info(f"Loaded profanity list {words_file.name}: {added} new terms (running total {len(merged)})")
            except Exception as e:
                logger.error(f"Failed to load profanity list {words_file}: {e}")

        self.profanity_words = merged
        logger.info(f"Profanity filter ready: {len(self.profanity_words)} unique terms from {len(json_files)} file(s)")

    def normalize_for_check(self, username: str) -> str:
        """
        Normalize username for checking
        - Convert to lowercase
        - Fold accents (e.g. café -> cafe)
        - Handle common obfuscations
        """
        if not username:
            return ""

        normalized = username.lower()

        for obf_char, replacement in self.obfuscation_map.items():
            normalized = normalized.replace(obf_char, replacement)

        return _fold_accents(normalized)

    def _check_exact_match(self, normalized: str) -> bool:
        """Check for exact matches in profanity list"""
        return normalized in self.profanity_words

    def _check_substring_match(self, normalized: str) -> bool:
        """Check if any profanity word appears as substring"""
        no_separators = normalized.replace('_', '').replace('-', '').replace(' ', '').replace('.', '')

        for word in self.profanity_words:
            if word in normalized or word in no_separators:
                if not self._is_whitelisted(normalized, word):
                    return True
        return False

    def _is_whitelisted(self, username: str, matched_word: str) -> bool:
        """
        Check if a match is a false positive
        Example: "class" contains "ass" but is legitimate
        """
        folded_user = _fold_accents(username.lower())

        if folded_user in self.whitelist:
            return True

        for whitelist_word in self.whitelist:
            if matched_word in whitelist_word and folded_user == _fold_accents(whitelist_word):
                return True

        return False

    def contains_profanity(self, username: str) -> bool:
        """
        Main method to check if username contains profanity
        Returns True if profanity detected, False otherwise

        Args:
            username: Username to check

        Returns:
            True if profanity detected, False otherwise
        """
        if not username or len(username) < 3:
            return False

        normalized = self.normalize_for_check(username)

        if self._check_exact_match(normalized):
            return True

        if self._check_substring_match(normalized):
            return True

        original_lower = username.lower()
        folded_original = _fold_accents(original_lower)
        if self._check_exact_match(folded_original):
            return True

        if self._check_substring_match(folded_original):
            return True

        return False


# Create singleton instance
content_filter = ContentFilter()
