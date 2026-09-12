"""Normalise the LaTeX that models emit into the dialect the frontend renders.

Models mix ``\\[ ... \\]`` / ``\\( ... \\)`` with ``$$ ... $$`` / ``$ ... $``;
the Markdown renderer only understands the dollar form.
"""

import re

BLOCK_DELIMITERS = re.compile(r"\\?\\\[(.*?)\\?\\\]", re.DOTALL)
INLINE_DELIMITERS = re.compile(r"\\?\\\((.*?)\\?\\\)")


def normalize_math_formulas(text: str) -> str:
    """Rewrite LaTeX delimiters to dollar signs and put block formulas on their own line."""
    if not text:
        return text

    text = BLOCK_DELIMITERS.sub(r"$$\1$$", text)
    text = INLINE_DELIMITERS.sub(r"$\1$", text)

    text = re.sub(r"([^\n])\$\$", r"\1\n$$", text)
    text = re.sub(r"\$\$([^\n])", r"$$\n\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
