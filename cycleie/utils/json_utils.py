"""Helpers for reading JSON out of free-form LLM output."""

import json
import re
from typing import Dict


def extract_json_from_text(text: str) -> Dict:
    """Return the first JSON object found in ``text``, or an empty dict.

    Handles the common cases of a bare object, an object wrapped in a fenced
    code block, and an object surrounded by prose.
    """
    if not text:
        return {}

    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass

    greedy = re.search(r"\{[\s\S]*\}", text)
    if greedy:
        try:
            return json.loads(greedy.group(0))
        except json.JSONDecodeError:
            pass

    for candidate in re.findall(r"\{[^{}]*\}", text):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    return {}
