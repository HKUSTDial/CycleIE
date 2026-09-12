"""Small text helpers shared by the agents."""

CHINESE_RANGE = ("\u4e00", "\u9fff")
CHINESE_RATIO_THRESHOLD = 0.1


def _is_chinese(char: str) -> bool:
    return CHINESE_RANGE[0] <= char <= CHINESE_RANGE[1]


def detect_language(text: str) -> str:
    """Return ``'chinese'`` when the text is predominantly Chinese."""
    if not text:
        return "english"
    chinese_chars = sum(1 for char in text if _is_chinese(char))
    return "chinese" if chinese_chars / len(text) > CHINESE_RATIO_THRESHOLD else "english"


def language_instruction(text: str) -> str:
    """Instruct the model to answer in the language of the input.

    The Loong benchmark mixes Chinese and English documents, so the answer
    language has to follow the question rather than the prompt template.
    """
    if detect_language(text) == "chinese":
        return "\n\nImportant: the query is in Chinese, so answer in Chinese."
    return "\n\nImportant: answer in English."


def content_length(text: str) -> int:
    """Approximate length as English words plus Chinese characters."""
    chinese_chars = sum(1 for char in text if _is_chinese(char))
    non_chinese = "".join(" " if _is_chinese(char) else char for char in text)
    return len(non_chinese.split()) + chinese_chars
