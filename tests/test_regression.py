"""
Regression tests for the Persona Wizard Core Engine.

Run with:  python -m pytest tests/ -v
       or: python -m unittest discover tests/
"""
from __future__ import annotations

import json
import random
import re
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from persona_engine.config import EngineConfig
from persona_engine.domain import PersonaSeed, PersonaSpec, LocalizedText
from persona_engine.generator import LLMGenerator
from persona_engine.inspiration import InspirationLibrary
from persona_engine.llm import LLMClient, parse_llm_response
from persona_engine.scorer import score_candidate
from persona_engine.storage import save_json
from persona_engine.templates import TemplateLibrary
from persona_engine.wizard import OPTIONAL_FIELDS, REQUIRED_FIELDS, WizardEngine, WizardSession

_PLACEHOLDER_RE = re.compile(r"\{[a-zA-Z0-9_]+\}")


# ---------------------------------------------------------------------------
# Shared fixtures — loaded once per process to keep tests fast
# ---------------------------------------------------------------------------

_FIXTURES: tuple | None = None


def _fixtures():
    global _FIXTURES
    if _FIXTURES is None:
        inspirations = InspirationLibrary.load()
        templates = TemplateLibrary.load()
        config = EngineConfig(random_seed=42)
        _FIXTURES = (inspirations, templates, config)
    return _FIXTURES


# ---------------------------------------------------------------------------
# 1. LLM generator — mock LLM returning valid JSON
# ---------------------------------------------------------------------------

_MOCK_LLM_RESPONSE_ZH = json.dumps({
    "identity": "流光，沉默的城市治愈者",
    "appearance": "身材纤细，留着一头栗色长发",
    "background": "曾是战地医护，退役后隐居城中",
    "personality": "沉默，但在关键时刻果断",
    "voice": "语速平稳，几乎不高声",
    "catchphrases": "「不一样了。」「我不会再那样了。」",
    "goals": "帮助他人找到方向",
    "relationships": "与一位旧友保持若即若离",
    "conflicts": "长期压抑的渴望与职责之间拉扯",
    "habits": "随手记录情绪波动",
    "skills": "擅长分析与调解",
    "values": "诚信与行动一致",
    "taboos": "不容忍背叛",
    "dialogue_examples": "> 用户：「你好。」\n> 流光：「……嗯。你来了。」",
    "opening_line": "（抱着手臂）「……你还要在那里站多久？」",
    "system_constraints": "1. 始终保持治愈者设定。\n2. 不会扮演角色以外的身份。",
    "tags": ["healer", "urban", "silent"],
}, ensure_ascii=False)


class _MockLLM(LLMClient):
    def generate(self, prompt: str, system: str | None = None, temperature: float = 0.7) -> str:
        return _MOCK_LLM_RESPONSE_ZH


class _AlwaysFailLLM(LLMClient):
    def generate(self, prompt: str, system: str | None = None, temperature: float = 0.7) -> str:
        raise RuntimeError("simulated LLM failure")


class TestLLMGenerator(unittest.TestCase):

    def test_mock_llm_produces_valid_spec(self):
        inspirations, templates, config = _fixtures()
        gen = LLMGenerator(_MockLLM(), config, inspirations, templates)
        seed = PersonaSeed(concept="沉默的城市治愈者")
        rnd = random.Random(1)
        cards = inspirations.select_cards([], config.inspiration_per_candidate, rnd)
        spec, ctx = gen.generate(seed, templates.templates[0], cards)
        self.assertTrue(spec.background.zh, "background.zh must not be empty")
        self.assertTrue(spec.personality.zh, "personality.zh must not be empty")
        self.assertTrue(spec.voice.zh, "voice.zh must not be empty")

    def test_always_fail_llm_raises(self):
        inspirations, templates, _ = _fixtures()
        config = EngineConfig(random_seed=0, llm_retries=0)
        gen = LLMGenerator(_AlwaysFailLLM(), config, inspirations, templates)
        seed = PersonaSeed(concept="孤独的守夜人")
        rnd = random.Random(1)
        cards = inspirations.select_cards([], config.inspiration_per_candidate, rnd)
        with self.assertRaises(RuntimeError):
            gen.generate(seed, templates.templates[0], cards)


# ---------------------------------------------------------------------------
# 2. parse_llm_response — single-language and legacy bilingual formats
# ---------------------------------------------------------------------------

class TestParseLLMResponse(unittest.TestCase):

    def test_single_language_zh(self):
        spec = parse_llm_response(_MOCK_LLM_RESPONSE_ZH, language="zh")
        self.assertIsNotNone(spec)
        self.assertEqual(spec.background.zh, "曾是战地医护，退役后隐居城中")
        self.assertEqual(spec.background.en, "")  # not filled

    def test_single_language_en(self):
        data = json.dumps({
            "identity": "Lumen, the silent urban healer",
            "appearance": "Slender figure",
            "background": "Former field medic",
            "personality": "Silent but decisive",
            "voice": "Steady pace",
            "catchphrases": "'Things are different now.'",
            "goals": "Help others find direction",
            "relationships": "Keeps distance",
            "conflicts": "Duty vs desire",
            "habits": "Records emotional shifts",
            "skills": "Analysis and mediation",
            "values": "Integrity",
            "taboos": "Does not tolerate betrayal",
            "dialogue_examples": "> You: 'Hello.'\\n> Lumen: '...Oh.'",
            "opening_line": "(arms crossed) '...How long will you stand there?'",
            "system_constraints": "1. Always maintain healer persona.",
            "tags": ["healer", "urban"],
        })
        spec = parse_llm_response(data, language="en")
        self.assertIsNotNone(spec)
        self.assertEqual(spec.background.en, "Former field medic")
        self.assertEqual(spec.background.zh, "")

    def test_invalid_json_returns_none(self):
        self.assertIsNone(parse_llm_response("not json"))

    def test_missing_required_field_returns_none(self):
        data = json.dumps({"identity": "test", "personality": "test"})
        self.assertIsNone(parse_llm_response(data, language="zh"))


# ---------------------------------------------------------------------------
# 3. Wizard — required fields cannot be bypassed with empty/whitespace
# ---------------------------------------------------------------------------

class TestWizardRequiredFields(unittest.TestCase):

    def setUp(self):
        self.wizard = WizardEngine()
        self.wizard.start("孤独的守夜人")

    def _first_required_q(self):
        for q in self.wizard.pending_questions():
            if q.field in REQUIRED_FIELDS:
                return q
        self.fail("No required question returned by wizard")

    def test_empty_string_rejected(self):
        q = self._first_required_q()
        returned = self.wizard.answer(q.field, "")
        self.assertNotIn(q.field, self.wizard.session.answered)
        self.assertTrue(any(r.field == q.field for r in returned),
            "Same question must be re-returned after empty answer")

    def test_whitespace_only_rejected(self):
        q = self._first_required_q()
        self.wizard.answer(q.field, "   \t  ")
        self.assertNotIn(q.field, self.wizard.session.answered)

    def test_valid_answer_accepted(self):
        q = self._first_required_q()
        self.wizard.answer(q.field, "曾是战地医护，退役后隐居城中")
        self.assertIn(q.field, self.wizard.session.answered)
        self.assertEqual(self.wizard.session.seed.answers[q.field], "曾是战地医护，退役后隐居城中")

    def test_optional_field_accepts_empty_as_skip(self):
        for field in list(REQUIRED_FIELDS):
            self.wizard.answer(field, f"stub for {field}")
        questions = self.wizard.pending_questions()
        if not questions:
            self.skipTest("No optional questions returned")
        opt_q = questions[0]
        self.assertNotIn(opt_q.field, REQUIRED_FIELDS)
        self.wizard.answer(opt_q.field, "")
        self.assertIn(opt_q.field, self.wizard.session.answered,
            "Empty answer for optional field must mark it answered (skip)")

    def test_optional_fields_asked_in_declared_order(self):
        """goals must always appear before conflicts."""
        for field in list(REQUIRED_FIELDS):
            self.wizard.answer(field, f"stub for {field}")

        seen: list[str] = []
        while True:
            qs = self.wizard.pending_questions()
            if not qs:
                break
            for q in qs:
                if q.field in OPTIONAL_FIELDS:
                    seen.append(q.field)
                self.wizard.answer(q.field, "skip" if q.field in REQUIRED_FIELDS else "")

        if "goals" in seen and "conflicts" in seen:
            self.assertLess(seen.index("goals"), seen.index("conflicts"),
                "goals must be asked before conflicts")


# ---------------------------------------------------------------------------
# 4. Scorer — values in [0, 1], never NaN
# ---------------------------------------------------------------------------

class TestScorerValidRange(unittest.TestCase):

    def _assert_range(self, score, label: str = ""):
        for attr in ("value", "coverage", "length", "richness"):
            val = getattr(score, attr)
            self.assertEqual(val, val, f"{label}{attr} is NaN")   # NaN != NaN
            self.assertGreaterEqual(val, 0.0, f"{label}{attr} < 0")
            self.assertLessEqual(val, 1.0, f"{label}{attr} > 1")

    def test_empty_spec_in_range(self):
        score = score_candidate(PersonaSpec(), EngineConfig())
        self._assert_range(score, "empty spec — ")

    def test_populated_scores_higher_than_empty(self):
        config = EngineConfig()
        empty_val = score_candidate(PersonaSpec(), config).value
        spec = parse_llm_response(_MOCK_LLM_RESPONSE_ZH, language="zh")
        self.assertIsNotNone(spec)
        self.assertGreater(score_candidate(spec, config).value, empty_val)


# ---------------------------------------------------------------------------
# 5. save_json — creates file, correct content, CJK preserved
# ---------------------------------------------------------------------------

class TestSaveJson(unittest.TestCase):

    def test_creates_file(self):
        import persona_engine.storage as mod
        original = mod.project_root
        with tempfile.TemporaryDirectory() as tmpdir:
            mod.project_root = lambda: Path(tmpdir)
            try:
                data = {"engine": "persona_wizard", "ok": True}
                path = save_json(data, "test.json")
                self.assertTrue(path.exists())
                self.assertEqual(json.loads(path.read_text("utf-8")), data)
            finally:
                mod.project_root = original

    def test_creates_output_directory(self):
        import persona_engine.storage as mod
        original = mod.project_root
        with tempfile.TemporaryDirectory() as tmpdir:
            mod.project_root = lambda: Path(tmpdir)
            try:
                save_json({}, "dir_test.json")
                self.assertTrue((Path(tmpdir) / "output").is_dir())
            finally:
                mod.project_root = original

    def test_cjk_round_trip(self):
        import persona_engine.storage as mod
        original = mod.project_root
        with tempfile.TemporaryDirectory() as tmpdir:
            mod.project_root = lambda: Path(tmpdir)
            try:
                data = {"concept": "沉默的守夜人", "tags": ["治愈", "孤独"]}
                path = save_json(data, "cjk.json")
                loaded = json.loads(path.read_text("utf-8"))
                self.assertEqual(loaded["concept"], "沉默的守夜人")
                self.assertEqual(loaded["tags"], ["治愈", "孤独"])
            finally:
                mod.project_root = original


# ---------------------------------------------------------------------------
# 6. WizardSession serialization — to_dict / from_dict round-trip
# ---------------------------------------------------------------------------

class TestWizardSerialization(unittest.TestCase):

    def _make_partial_session(self) -> WizardEngine:
        wizard = WizardEngine()
        wizard.start("孤独的守夜人")
        wizard.answer("background", "曾是战地医护，退役后隐居城中")
        wizard.answer("personality", "沉默，但在关键时刻果断")
        return wizard

    def test_session_to_dict_is_json_serializable(self):
        wizard = self._make_partial_session()
        data = wizard.to_dict()
        # Must not raise
        json.dumps(data, ensure_ascii=False)

    def test_session_round_trip_preserves_answers(self):
        wizard = self._make_partial_session()
        data = wizard.to_dict()

        restored = WizardEngine.from_dict(data)
        self.assertEqual(
            restored.session.seed.answers.get("background"),
            "曾是战地医护，退役后隐居城中",
        )
        self.assertEqual(
            restored.session.seed.answers.get("personality"),
            "沉默，但在关键时刻果断",
        )

    def test_session_round_trip_preserves_answered_set(self):
        wizard = self._make_partial_session()
        original_answered = set(wizard.session.answered)
        data = wizard.to_dict()

        restored = WizardEngine.from_dict(data)
        self.assertEqual(restored.session.answered, original_answered)

    def test_session_round_trip_preserves_stage(self):
        wizard = self._make_partial_session()
        data = wizard.to_dict()
        self.assertEqual(data["session"]["stage"], "questioning")

        restored = WizardEngine.from_dict(data)
        self.assertEqual(restored.session.stage, "questioning")

    def test_restored_session_continues_correctly(self):
        """Restored engine must continue asking only unanswered fields."""
        wizard = self._make_partial_session()
        # background and personality answered; voice still pending
        data = wizard.to_dict()

        restored = WizardEngine.from_dict(data)
        questions = restored.pending_questions()
        pending_fields = {q.field for q in questions}
        self.assertIn("voice", pending_fields,
            "voice should still be pending after restore")
        self.assertNotIn("background", pending_fields,
            "background must not be re-asked after restore")
        self.assertNotIn("personality", pending_fields,
            "personality must not be re-asked after restore")

    def test_llm_api_key_not_in_serialized_dict(self):
        """API key must never appear in serialized output."""
        config = EngineConfig(llm_api_key="sk-secret-key-12345")
        wizard = WizardEngine(config=config)
        wizard.start("测试")
        data = wizard.to_dict()
        serialized = json.dumps(data)
        self.assertNotIn("sk-secret-key-12345", serialized)
        self.assertNotIn("llm_api_key", serialized)

    def test_from_dict_accepts_llm_api_key(self):
        """from_dict must accept llm_api_key and pass it to config."""
        wizard = self._make_partial_session()
        data = wizard.to_dict()
        restored = WizardEngine.from_dict(data, llm_api_key="sk-restored-key")
        self.assertEqual(restored.config.llm_api_key, "sk-restored-key")


# ---------------------------------------------------------------------------
# 7. Safety — constraint conflict detection and spec scanning
# ---------------------------------------------------------------------------

from persona_engine.safety import (
    ConstraintConflict,
    SafetyFlag,
    detect_constraint_conflicts,
    safety_score_penalty,
    scan_spec,
)


class TestConstraintConflicts(unittest.TestCase):

    def test_no_conflicts_empty_list(self):
        self.assertEqual(detect_constraint_conflicts([]), [])

    def test_no_conflicts_single_item(self):
        self.assertEqual(detect_constraint_conflicts(["温柔"]), [])

    def test_no_conflicts_compatible_traits(self):
        self.assertEqual(detect_constraint_conflicts(["温柔", "内向", "诚实"]), [])

    def test_detects_warmth_cruelty_conflict(self):
        result = detect_constraint_conflicts(["温柔", "冷酷"])
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], ConstraintConflict)
        self.assertEqual({result[0].a, result[0].b}, {"温柔", "冷酷"})

    def test_detects_introvert_extrovert_conflict(self):
        result = detect_constraint_conflicts(["内向", "外向", "诚实"])
        conflict_pairs = [{c.a, c.b} for c in result]
        self.assertIn({"内向", "外向"}, conflict_pairs)

    def test_detects_multiple_conflicts(self):
        result = detect_constraint_conflicts(["温柔", "冷酷", "内向", "外向"])
        self.assertGreaterEqual(len(result), 2)

    def test_case_insensitive(self):
        result = detect_constraint_conflicts(["  温柔  ", "冷酷"])
        self.assertEqual(len(result), 1)


class TestSpecSafetyScanning(unittest.TestCase):

    def _make_spec(self, **kwargs) -> PersonaSpec:
        spec = PersonaSpec()
        for field_name, (zh, en) in kwargs.items():
            setattr(spec, field_name, LocalizedText(zh=zh, en=en))
        return spec

    def test_clean_spec_no_flags(self):
        self.assertEqual(scan_spec(PersonaSpec()), [])

    def test_detects_gender_stereotype_zh(self):
        spec = self._make_spec(background=("女性应该保持沉默", ""))
        flags = scan_spec(spec)
        self.assertTrue(any(f.category == "gender_stereotype" for f in flags))

    def test_detects_gender_stereotype_en(self):
        spec = self._make_spec(background=("", "women should naturally stay quiet"))
        flags = scan_spec(spec)
        self.assertTrue(any(f.category == "gender_stereotype" for f in flags))

    def test_detects_violence_incitement(self):
        spec = self._make_spec(values=("鼓励暴力伤害他人", ""))
        flags = scan_spec(spec)
        self.assertTrue(any(f.category == "violence_incitement" for f in flags))

    def test_normal_content_not_flagged(self):
        spec = self._make_spec(
            background=("曾是战地医护，退役后隐居城中", "Former field medic, now living quietly."),
            personality=("沉默，但在关键时刻果断", "Silent but decisive when it matters."),
        )
        self.assertEqual(scan_spec(spec), [])

    def test_flag_records_correct_field_and_lang(self):
        spec = self._make_spec(personality=("", "men should always lead"))
        flags = scan_spec(spec)
        self.assertTrue(any(f.field == "personality" and f.lang == "en" for f in flags))


class TestSafetyScorePenalty(unittest.TestCase):

    def test_no_flags_zero_penalty(self):
        self.assertEqual(safety_score_penalty([]), 0.0)

    def test_low_severity_small_penalty(self):
        flag = SafetyFlag(field="x", lang="zh", matched="", category="c", severity="low")
        self.assertAlmostEqual(safety_score_penalty([flag]), 0.05)

    def test_high_severity_large_penalty(self):
        flag = SafetyFlag(field="x", lang="zh", matched="", category="c", severity="high")
        self.assertAlmostEqual(safety_score_penalty([flag]), 0.35)

    def test_penalty_capped_at_one(self):
        flags = [
            SafetyFlag(field="x", lang="zh", matched="", category="c", severity="high")
            for _ in range(10)
        ]
        self.assertLessEqual(safety_score_penalty(flags), 1.0)

    def test_high_flag_reduces_candidate_score(self):
        spec = parse_llm_response(_MOCK_LLM_RESPONSE_ZH, language="zh")
        self.assertIsNotNone(spec)
        config = EngineConfig()
        clean_score = score_candidate(spec, config).value

        flag = SafetyFlag(field="background", lang="zh", matched="x",
                          category="violence_incitement", severity="high")
        penalised = max(0.0, clean_score - safety_score_penalty([flag]))
        self.assertLess(penalised, clean_score)


if __name__ == "__main__":
    unittest.main(verbosity=2)
