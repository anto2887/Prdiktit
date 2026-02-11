"""
Content filtering service for usernames
Detects profanity, slurs, and inappropriate content
"""
import json
import logging
import os
from pathlib import Path
from typing import Set

logger = logging.getLogger(__name__)


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
        """Load profanity word list from JSON file"""
        try:
            # Get the path to the profanity words file
            current_dir = Path(__file__).parent.parent
            words_file = current_dir / "utils" / "profanity_words.json"
            
            if not words_file.exists():
                logger.warning(f"Profanity words file not found at {words_file}")
                return
            
            with open(words_file, 'r', encoding='utf-8') as f:
                words = json.load(f)
                self.profanity_words = {word.lower() for word in words if word}
                logger.info(f"Loaded {len(self.profanity_words)} profanity words")
        except Exception as e:
            logger.error(f"Failed to load profanity list: {str(e)}")
            self.profanity_words = set()
    
    def normalize_for_check(self, username: str) -> str:
        """
        Normalize username for checking
        - Convert to lowercase
        - Handle common obfuscations
        - Remove separators
        """
        if not username:
            return ""
        
        # Convert to lowercase
        normalized = username.lower()
        
        # Replace obfuscation characters
        for obf_char, replacement in self.obfuscation_map.items():
            normalized = normalized.replace(obf_char, replacement)
        
        # Remove common separators (but keep for substring matching)
        # We'll check both with and without separators
        
        return normalized
    
    def _check_exact_match(self, normalized: str) -> bool:
        """Check for exact matches in profanity list"""
        return normalized in self.profanity_words
    
    def _check_substring_match(self, normalized: str) -> bool:
        """Check if any profanity word appears as substring"""
        # Remove separators for substring matching
        no_separators = normalized.replace('_', '').replace('-', '').replace(' ', '').replace('.', '')
        
        for word in self.profanity_words:
            # Check if word appears in normalized username
            if word in normalized or word in no_separators:
                # Check if it's a false positive (whitelist)
                if not self._is_whitelisted(normalized, word):
                    return True
        return False
    
    def _is_whitelisted(self, username: str, matched_word: str) -> bool:
        """
        Check if a match is a false positive
        Example: "class" contains "ass" but is legitimate
        """
        # Check if username is in whitelist
        if username.lower() in self.whitelist:
            return True
        
        # Check if matched word is part of a legitimate word
        for whitelist_word in self.whitelist:
            if matched_word in whitelist_word and username.lower() == whitelist_word:
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
        
        # Normalize username
        normalized = self.normalize_for_check(username)
        
        # Check exact match
        if self._check_exact_match(normalized):
            return True
        
        # Check substring match
        if self._check_substring_match(normalized):
            return True
        
        # Also check original username (in case obfuscation normalization missed something)
        original_lower = username.lower()
        if self._check_exact_match(original_lower):
            return True
        
        if self._check_substring_match(original_lower):
            return True
        
        return False


# Create singleton instance
content_filter = ContentFilter()
