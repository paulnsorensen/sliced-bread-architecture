#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKER = ROOT / "scripts/check-contracts.mjs"

WITNESSES = {
    "AC-1": "Current tree has no JSON contract; assert schema and ordered-case validation fails before implementation.",
    "AC-2": "Remove one declared consumer and corrupt one block; current checker returns zero or skips the file, but the contract requires nonzero and path/block diagnostics.",
    "AC-3": "Current site catalog omits `slice-and-spine-review`; assert exact four-row parity and nonzero on omission.",
    "AC-4": "Current generic blocker prose conflicts with medium cases; assert lossless severity-block parity and explicit ten-dimension audit metadata.",
    "AC-5": "Current summaries use an absolute 2+ rule; assert pressure-first text and both ordered exception cases.",
    "AC-6": "Current ADRs lack required frontmatter and uniform sections; assert named field/section diagnostics and nonzero exit.",
    "AC-7": "Current output contains `Entry docs → 404 was not found`; assert absence of that warning and presence of generated `dist/404.html`.",
}

EXPECTED_DIMENSIONS = [
    "import-direction",
    "crust-integrity",
    "model-purity",
    "growth-justification",
    "event-usage",
    "correctness",
    "security",
    "complexity",
    "deslop",
    "tests",
]


def fail(acceptance_id: str, detail: str) -> None:
    raise AssertionError(f"{WITNESSES[acceptance_id]}\n{detail}")


def run(argv: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, cwd=cwd, text=True, capture_output=True, check=False)


def output(result: subprocess.CompletedProcess[str]) -> str:
    return result.stdout + result.stderr


def require_checker(acceptance_id: str, root: Path = ROOT) -> Path:
    checker = root / "scripts/check-contracts.mjs"
    if not checker.is_file():
        fail(acceptance_id, f"missing public CLI: {checker.relative_to(root)}")
    return checker


def check_repo(acceptance_id: str, root: Path = ROOT) -> subprocess.CompletedProcess[str]:
    checker = require_checker(acceptance_id, root)
    result = run(["node", str(checker)], root)
    if result.returncode != 0:
        fail(acceptance_id, f"contract checker exited {result.returncode}:\n{output(result)}")
    return result


def checked_block(path: Path, name: str, acceptance_id: str) -> str:
    text = path.read_text()
    start = f"<!-- {name}:start -->"
    end = f"<!-- {name}:end -->"
    if text.count(start) != 1 or text.count(end) != 1:
        fail(acceptance_id, f"{path.relative_to(ROOT)} must contain one {name} marker pair")
    block = text.split(start, 1)[1].split(end, 1)[0].strip()
    if not block:
        fail(acceptance_id, f"{path.relative_to(ROOT)} has an empty {name} block")
    return block


def copy_contract_tree(destination: Path) -> None:
    for relative in ("reference", "scripts", "skills", "docs/adr", "site/src/content/docs"):
        source = ROOT / relative
        shutil.copytree(source, destination / relative)
    shutil.copy2(ROOT / "README.md", destination / "README.md")


def replace_block(path: Path, name: str, replacement: str) -> None:
    text = path.read_text()
    start = f"<!-- {name}:start -->"
    end = f"<!-- {name}:end -->"
    before, remainder = text.split(start, 1)
    _, after = remainder.split(end, 1)
    path.write_text(f"{before}{start}\n{replacement}\n{end}{after}")


def assert_fixture_failure(
    acceptance_id: str,
    root: Path,
    expected_fragments: list[str],
) -> None:
    checker = require_checker(acceptance_id, root)
    result = run(["node", str(checker)], root)
    combined = output(result)
    if result.returncode != 1:
        fail(acceptance_id, f"fixture checker exit was {result.returncode}, not 1:\n{combined}")
    missing = [fragment for fragment in expected_fragments if fragment not in combined]
    if missing:
        fail(acceptance_id, f"fixture diagnostics omitted {missing!r}:\n{combined}")


def ac1_matrix(row: str) -> None:
    acceptance_id = "AC-1"
    check_repo(acceptance_id)
    contract_path = ROOT / "reference/doctrine-contracts.json"
    if not contract_path.is_file():
        fail(acceptance_id, "reference/doctrine-contracts.json is missing")
    contract = json.loads(contract_path.read_text())
    if contract.get("schema_version") != 1:
        fail(acceptance_id, f"schema_version was {contract.get('schema_version')!r}, not 1")
    if contract.get("match_policy") != "first-match":
        fail(acceptance_id, f"match_policy was {contract.get('match_policy')!r}")

    severity = contract.get("severity_cases")
    growth = contract.get("growth_cases")
    if not isinstance(severity, list) or not isinstance(growth, list):
        fail(acceptance_id, "severity_cases and growth_cases must both be arrays")
    cases = severity + growth
    ids = [case.get("id") for case in cases]
    if len(ids) != len(set(ids)):
        fail(acceptance_id, f"case IDs are not unique: {ids!r}")

    case_id, expected = row.split(" → ", 1)
    matches = [case for case in cases if case.get("id") == case_id]
    if len(matches) != 1:
        fail(acceptance_id, f"expected exactly one case {case_id!r}, found {len(matches)}")
    if matches[0].get("expected") != expected:
        fail(acceptance_id, f"{case_id} resolved to {matches[0].get('expected')!r}, not {expected!r}")

    severity_ids = [case.get("id") for case in severity]
    generic_severity = severity_ids.index("severity-other-forbidden-edge")
    for specific in ("severity-static-domain-infra", "severity-static-concrete-adapter"):
        if severity_ids.index(specific) >= generic_severity:
            fail(acceptance_id, f"{specific} does not precede the generic forbidden-edge fallback")
    growth_ids = [case.get("id") for case in growth]
    generic_growth = growth_ids.index("growth-single-unpressured")
    for exception in ("growth-cycle-event", "growth-positional-one-file"):
        if growth_ids.index(exception) >= generic_growth:
            fail(acceptance_id, f"{exception} does not precede the unsupported-growth fallback")


def ac2_fixture_failures() -> None:
    acceptance_id = "AC-2"
    check_repo(acceptance_id)
    with tempfile.TemporaryDirectory() as temporary:
        base = Path(temporary)
        missing_root = base / "missing"
        copy_contract_tree(missing_root)
        missing_path = missing_root / "skills/sliced-bread-depth/SKILL.md"
        missing_path.unlink()
        assert_fixture_failure(
            acceptance_id,
            missing_root,
            ["skills/sliced-bread-depth/SKILL.md", "doctrine:growth-cases"],
        )

        divergent_root = base / "divergent"
        copy_contract_tree(divergent_root)
        divergent_path = divergent_root / "site/src/content/docs/reference/sliced-bread.md"
        replace_block(divergent_path, "doctrine:severity-cases", "corrupt")
        assert_fixture_failure(
            acceptance_id,
            divergent_root,
            ["site/src/content/docs/reference/sliced-bread.md", "doctrine:severity-cases"],
        )


def ac3_catalog() -> None:
    acceptance_id = "AC-3"
    check_repo(acceptance_id)
    local = checked_block(ROOT / "skills/README.md", "skills:catalog", acceptance_id)
    site = checked_block(ROOT / "site/src/content/docs/skills.md", "skills:catalog", acceptance_id)
    if local != site:
        fail(acceptance_id, "local and published skills:catalog blocks differ")
    rows = re.findall(r"^\| `([^`]+)`", local, re.MULTILINE)
    expected = [
        "sliced-bread-review",
        "sliced-bread-audit",
        "sliced-bread-depth",
        "slice-and-spine-review",
    ]
    if rows != expected:
        fail(acceptance_id, f"catalog rows were {rows!r}, not {expected!r}")

    with tempfile.TemporaryDirectory() as temporary:
        fixture = Path(temporary)
        copy_contract_tree(fixture)
        catalog = fixture / "site/src/content/docs/skills.md"
        catalog.write_text(
            "\n".join(line for line in catalog.read_text().splitlines() if "slice-and-spine-review" not in line)
            + "\n"
        )
        assert_fixture_failure(
            acceptance_id,
            fixture,
            ["site/src/content/docs/skills.md", "skills:catalog"],
        )


def ac4_review_audit() -> None:
    acceptance_id = "AC-4"
    check_repo(acceptance_id)
    paths = [
        ROOT / "reference/sliced-bread.md",
        ROOT / "skills/sliced-bread-review/SKILL.md",
        ROOT / "skills/sliced-bread-audit/sliced-bread-audit.js",
    ]
    blocks = [checked_block(path, "doctrine:severity-cases", acceptance_id) for path in paths]
    if blocks != [blocks[0]] * len(blocks):
        fail(acceptance_id, "review and audit severity-case blocks do not match canonical doctrine")
    for case_id, severity in (
        ("severity-static-domain-infra", "medium"),
        ("severity-static-concrete-adapter", "medium"),
        ("severity-other-forbidden-edge", "blocker"),
    ):
        if case_id not in blocks[0] or severity not in blocks[0]:
            fail(acceptance_id, f"severity block omits {case_id} → {severity}")

    audit = paths[2].read_text()
    match = re.search(r"const dimensions = \[(.*?)\n\]", audit, re.DOTALL)
    dimensions = re.findall(r"'([^']+)'", match.group(1)) if match else []
    if dimensions != EXPECTED_DIMENSIONS:
        fail(acceptance_id, f"audit dimensions were {dimensions!r}, not {EXPECTED_DIMENSIONS!r}")
    for label in ("architecture_findings", "quality_findings"):
        if label not in audit:
            fail(acceptance_id, f"audit output omits the {label!r} category")


def ac5_growth_summary() -> None:
    acceptance_id = "AC-5"
    check_repo(acceptance_id)
    contract = json.loads((ROOT / "reference/doctrine-contracts.json").read_text())
    rows = [(case.get("id"), case.get("expected")) for case in contract.get("growth_cases", [])]
    expected_rows = [
        ("growth-cycle-event", "allow"),
        ("growth-positional-one-file", "allow"),
        ("growth-single-unpressured", "medium"),
    ]
    if rows != expected_rows:
        fail(acceptance_id, f"growth cases were {rows!r}, not {expected_rows!r}")

    for path in (ROOT / "README.md", ROOT / "site/src/content/docs/index.mdx"):
        summary = " ".join(path.read_text().lower().replace("-", " ").split())
        required = [
            "demonstrated pressure",
            "two concrete consumers",
            "cycle breaking event dispatcher",
            "one file positional crust",
        ]
        missing = [phrase for phrase in required if phrase not in summary]
        if missing:
            fail(acceptance_id, f"{path.relative_to(ROOT)} omits growth guidance {missing!r}")


def ac6_adrs() -> None:
    acceptance_id = "AC-6"
    check_repo(acceptance_id)
    adrs = sorted((ROOT / "docs/adr").glob("*.md"))
    if len(adrs) != 5:
        fail(acceptance_id, f"expected five ADRs, found {[path.name for path in adrs]!r}")
    for path in adrs:
        text = path.read_text()
        frontmatter = text.split("---", 2)[1] if text.startswith("---\n") else ""
        fields = dict(
            match.groups()
            for line in frontmatter.splitlines()
            if (match := re.fullmatch(r"([a-z_]+):\s*(.+)", line))
        )
        if fields.get("status") != "accepted":
            fail(acceptance_id, f"{path.name} status was {fields.get('status')!r}")
        for field in ("date", "last_verified"):
            value = fields.get(field, "")
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) is None:
                fail(acceptance_id, f"{path.name} has invalid {field}: {value!r}")
        for heading in ("Confirmation", "References"):
            match = re.search(rf"^## {heading}\n+(.+?)(?=^## |\Z)", text, re.MULTILINE | re.DOTALL)
            if match is None or not match.group(1).strip():
                fail(acceptance_id, f"{path.name} has no non-empty {heading} section")

    with tempfile.TemporaryDirectory() as temporary:
        fixture = Path(temporary)
        copy_contract_tree(fixture)
        malformed = fixture / "docs/adr/sliced-bread-doctrine-revision-001.md"
        malformed.write_text("---\ndate: no\n---\n# Broken ADR\n")
        assert_fixture_failure(
            acceptance_id,
            fixture,
            [malformed.relative_to(fixture).as_posix(), "status", "last_verified", "Confirmation", "References"],
        )


class PageFacts(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.element = ""
        self.heading = ""
        self.paragraphs: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.href = ""
        self.text = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"h1", "p", "a"}:
            self.element = tag
            self.text = ""
            self.href = dict(attrs).get("href") or ""

    def handle_data(self, data: str) -> None:
        if self.element:
            self.text += data

    def handle_endtag(self, tag: str) -> None:
        text = " ".join(self.text.split())
        if tag == "h1":
            self.heading = text
        elif tag == "p" and text:
            self.paragraphs.append(text)
        elif tag == "a":
            self.links.append((self.href, text))
        if tag == self.element:
            self.element = ""
            self.text = ""
            self.href = ""


def ac7_site_404() -> None:
    acceptance_id = "AC-7"
    site = ROOT / "site"
    dist = site / "dist"
    generated_dirs = [dist, site / ".astro"]
    generated_files = [
        site / "node_modules/.vite/deps/_metadata.json",
        site / "node_modules/.astro/data-store.json",
    ]
    generated_before = {
        path: path.read_bytes() if path.is_file() else None for path in generated_files
    }
    page_html: str | None = None
    with tempfile.TemporaryDirectory() as temporary:
        snapshots: dict[Path, Path | None] = {}
        for index, path in enumerate(generated_dirs):
            snapshot = Path(temporary) / str(index)
            if path.is_dir():
                shutil.copytree(path, snapshot)
                snapshots[path] = snapshot
            else:
                snapshots[path] = None
        try:
            result = run(["npm", "run", "build"], site)
            page = dist / "404.html"
            if page.is_file():
                page_html = page.read_text()
        finally:
            for path, snapshot in snapshots.items():
                shutil.rmtree(path, ignore_errors=True)
                if snapshot is not None:
                    shutil.copytree(snapshot, path)
            for path, content in generated_before.items():
                if content is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(content)

    combined = output(result)
    if result.returncode != 0:
        fail(acceptance_id, f"site build exited {result.returncode}:\n{combined}")
    warning = "Entry docs → 404 was not found"
    if warning in combined:
        fail(acceptance_id, f"site build still emitted {warning!r}")
    if page_html is None:
        fail(acceptance_id, "site/dist/404.html was not generated")

    facts = PageFacts()
    facts.feed(page_html)
    if "not found" not in facts.heading.lower():
        fail(acceptance_id, f"404 heading was {facts.heading!r}")
    if not any("documentation" in paragraph.lower() for paragraph in facts.paragraphs):
        fail(acceptance_id, f"404 copy does not explain the missing documentation page: {facts.paragraphs!r}")
    if not any(
        href == "/sliced-bread-architecture/" and "documentation" in text.lower()
        for href, text in facts.links
    ):
        fail(acceptance_id, f"404 page has no documentation-index link: {facts.links!r}")


CASES = {
    "severity-import-exec": lambda: ac1_matrix("severity-import-exec → blocker"),
    "severity-static-domain-infra": lambda: ac1_matrix("severity-static-domain-infra → medium"),
    "severity-static-concrete-adapter": lambda: ac1_matrix("severity-static-concrete-adapter → medium"),
    "severity-other-forbidden-edge": lambda: ac1_matrix("severity-other-forbidden-edge → blocker"),
    "growth-cycle-event": lambda: ac1_matrix("growth-cycle-event → allow"),
    "growth-positional-one-file": lambda: ac1_matrix("growth-positional-one-file → allow"),
    "growth-single-unpressured": lambda: ac1_matrix("growth-single-unpressured → medium"),
    "ac2-fixtures": ac2_fixture_failures,
    "ac3-catalog": ac3_catalog,
    "ac4-review-audit": ac4_review_audit,
    "ac5-growth-summary": ac5_growth_summary,
    "ac6-adrs": ac6_adrs,
    "ac7-site-404": ac7_site_404,
}


def main() -> None:
    selector = sys.argv[1] if len(sys.argv) == 2 else ""
    case = CASES.get(selector)
    if case is None:
        raise SystemExit(f"usage: {Path(sys.argv[0]).name} <{'|'.join(CASES)}>")
    case()


if __name__ == "__main__":
    main()
