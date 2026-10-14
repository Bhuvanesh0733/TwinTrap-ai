# Research Gap (placeholder)

**This entire document is a scaffold.** Nothing below is a real citation, and nothing here should be
copied into a report as-is. Fill in `PAPER_A_*` / `PAPER_B_*` / `FINAL_RESEARCH_GAP` once you have two
verified papers from IEEE, Springer, or arXiv, then update
`backend/app/services/research_content.py::RESEARCH_CASE_STUDY` (the single source of truth the
**Research / Case Study** page reads from) to match.

## Required structure

```
PAPER_A
   ↓  (identify a real, specific limitation stated in or inferable from Paper A)
PAPER_A_LIMITATION
   ↓
PAPER_B
   ↓  (identify a real, specific limitation stated in or inferable from Paper B)
PAPER_B_LIMITATION
   ↓
FINAL_RESEARCH_GAP   (narrow, experimentally testable by THIS codebase)
   ↓
Proposed solution (already drafted, see research_content.py — revise once the gap is finalized)
   ↓
Implementation (this codebase)
   ↓
Experimental evaluation (docs/experiments.md)
```

## Fields to fill in

### Paper A
- **Title:**
- **Authors:**
- **Venue (IEEE / Springer / arXiv):**
- **Year:**
- **DOI / URL:**
- **2–4 sentence factual summary:**
- **Specific, verifiable limitation** (something the paper itself reports, or that follows directly from
  its stated method/results/dataset — not a vague "doesn't cover everything"):

### Paper B
- **Title:**
- **Authors:**
- **Venue:**
- **Year:**
- **DOI / URL:**
- **2–4 sentence factual summary:**
- **Specific, verifiable limitation:**

### Final research gap
Write ONE or TWO sentences that:
1. Follow logically from Paper A's limitation AND Paper B's limitation together (not just one of them).
2. Are **narrow** enough to be testable with the experiments already in this codebase (class imbalance,
   PCA/SVD/LDA separability, SHAP explainability, multi-sensor discrepancy fusion, hyperparameter
   sensitivity) — or narrow enough that you can say precisely what new experiment would be needed.
3. Avoid categorical claims like "no previous work has solved this" — say specifically what Paper A and
   Paper B did NOT test, evaluate, or support.

## Rules (do not violate these when filling this in)

- Do not invent a title, author, DOI, or year "that sounds plausible."
- Do not claim a paper found a limitation it did not actually report, unless you can point to where in
  the paper the limitation follows from the stated method/results — and say so explicitly.
- Do not claim TwinTrap AI is the first system to address the gap — say what makes this implementation's
  approach specifically different (e.g. its discrepancy-feature engineering, its explicit imbalance
  sweep, or its SHAP explanations), not that nothing else exists.
- If, after reading Paper A and Paper B, the honest gap is narrower or different from what
  `research_content.py::proposed_solution` currently describes, **revise the proposed solution text** —
  don't leave it contradicting the finalized gap.
