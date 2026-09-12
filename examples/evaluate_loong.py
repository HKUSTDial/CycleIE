"""Reproduce the Loong results of the paper.

Expects the Loong release (https://github.com/MozerWang/Loong) laid out as::

    <loong-dir>/loong.jsonl                 one record per question
    <loong-dir>/data/evidence/data_<id>.json  the per-question evidence

Each question is answered by CycleIE and scored by an LLM judge, following the
Loong protocol: ``LLM`` is the mean judge score (0-100) and ``EM`` is the
fraction of answers that receive a perfect score.

Usage::

    python examples/evaluate_loong.py --loong-dir ./Loong --output ./results
    python examples/evaluate_loong.py --loong-dir ./Loong --variant wo_verify
"""

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

from cycleie import run_cycleie
from cycleie.llm import get_llm_response

JUDGE_MODEL = "gpt-4"
PERFECT_SCORE = 100

JUDGE_PROMPT = """[Gold Answer]
{gold}

[The Start of Assistant's Predicted Answer]
{prediction}
[The End of Assistant's Predicted Answer]

[System]
We would like to request your feedback on the performance of the AI assistant in response to the user question displayed above according to the gold answer. Please use the following listed aspects and their descriptions as evaluation criteria:
- Accuracy and Hallucinations: The assistant's answer is semantically consistent with the gold answer; The numerical value and order need to be accurate, and there should be no hallucinations.
- Completeness: Referring to the reference answers, the assistant's answer should contain all the key points needed to answer the user's question; further elaboration on these key points can be omitted. Please rate whether this answer is suitable for the question. Please note that the gold answer can be considered as a correct answer to the question. The assistant receives an overall score on a scale of 0 to 100, where a higher score indicates better overall performance. Please note that if the assistant's answer and the gold answer fully meet the above criteria, its overall rating should be the full marks (100). Please first provide a comprehensive explanation of your evaluation, avoiding any potential bias. Then, output a line indicating the score of the Assistant. PLEASE OUTPUT WITH THE FOLLOWING FORMAT, WHERE THE SCORE IS A SCALE OF 0 TO 100 BY STRICTLY FOLLOWING THIS FORMAT: "[[score]]", FOR EXAMPLE "Rating: [[100]]":

<Start Output>

Evaluation evidence: your evaluation explanation here, no more than 100 words Rating: [[score]]

<End Output>

Now, start your evaluation:
"""


def build_question(record: dict) -> str:
    """Fill the Loong prompt template with the question and its instruction."""
    template = record["prompt_template"]
    for placeholder, value in (("{question}", record["question"]), ("{instruction}", record["instruction"])):
        template = template.replace(placeholder, value)
    return template


def judge(prediction: str, gold: str, model: str) -> int:
    """Return the judge score, or 0 when the verdict cannot be parsed."""
    verdict = get_llm_response(JUDGE_PROMPT.format(gold=gold, prediction=prediction), model=model)
    match = re.search(r"\[\[(\d+)\]\]", verdict or "")
    return int(match.group(1)) if match else 0


def report(results: list) -> None:
    """Print the instance-weighted LLM and EM scores per length set and task."""
    buckets = defaultdict(list)
    for item in results:
        buckets[(item["set"], item["type"])].append(item["score"])
        buckets[(item["set"], "Overall")].append(item["score"])

    print(f"\n{'Set':<6}{'Task':<24}{'N':>5}{'LLM':>9}{'EM':>7}")
    for (length_set, task) in sorted(buckets, key=lambda key: (key[0], key[1])):
        scores = buckets[(length_set, task)]
        llm_score = sum(scores) / len(scores)
        exact_match = sum(1 for s in scores if s == PERFECT_SCORE) / len(scores)
        print(f"{length_set:<6}{task:<24}{len(scores):>5}{llm_score:>9.2f}{exact_match:>7.2f}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--loong-dir", type=Path, required=True, help="Root of the Loong release")
    parser.add_argument("--questions", default="loong.jsonl", help="Question file inside --loong-dir")
    parser.add_argument("--output", type=Path, default=Path("results"), help="Where per-question results are written")
    parser.add_argument("--model", default=None, help="Backbone model; defaults to the configured one")
    parser.add_argument("--judge-model", default=JUDGE_MODEL)
    parser.add_argument("--variant", default="full", choices=["full", "wo_verify", "wo_extract"])
    parser.add_argument("--limit", type=int, default=None, help="Evaluate only the first N questions")
    args = parser.parse_args()

    output_dir = args.output / args.variant
    output_dir.mkdir(parents=True, exist_ok=True)

    records = [json.loads(line) for line in (args.loong_dir / args.questions).read_text(encoding="utf-8").splitlines() if line.strip()]
    if args.limit:
        records = records[: args.limit]

    results = []
    for position, record in enumerate(records, start=1):
        result_file = output_dir / f"{record['id']}.json"
        if result_file.exists():
            results.append(json.loads(result_file.read_text(encoding="utf-8")))
            continue

        evidence_file = args.loong_dir / "data" / "evidence" / f"data_{record['id']}.json"
        evidence = evidence_file.read_text(encoding="utf-8") if evidence_file.exists() else ""

        # The Retriever starts from the evidence and only searches the full
        # document set when the Verifier judges that context insufficient.
        documents = [evidence, str(record["docs"])]

        question = build_question(record)
        answer = run_cycleie(
            query=question,
            documents=documents,
            doc_mode="contents",
            model=args.model,
            variant=args.variant,
        )["answer"]

        item = {
            "id": record["id"],
            "set": record["set"],
            "type": record["type"],
            "level": record["level"],
            "question": question,
            "answer": answer,
            "std_answer": record["answer"],
            "score": judge(answer, record["answer"], args.judge_model),
        }
        result_file.write_text(json.dumps(item, ensure_ascii=False, indent=2), encoding="utf-8")
        results.append(item)
        print(f"[{position}/{len(records)}] id={record['id']} score={item['score']}")

    report(results)


if __name__ == "__main__":
    main()
