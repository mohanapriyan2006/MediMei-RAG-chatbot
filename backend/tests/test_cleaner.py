from app.services.pdf.cleaner import clean_text


def test_clean_preserves_dosage_values():
    # All of these must survive cleaning (lowercased if needed, but not removed).
    cases = [
        ("10 mg", "10 mg"),
        ("5 mL", "5 ml"),
        ("2.5 mg/kg", "2.5 mg/kg"),
        ("once daily", "once daily"),
        ("twice daily", "twice daily"),
        ("0.5 mg", "0.5 mg"),
        ("10-20 mg", "10-20 mg"),
        ("1:1000", "1:1000"),
    ]
    for raw, expected in cases:
        assert clean_text(raw) == expected, f"clean_text changed {raw!r}"


def test_collapse_horizontal_whitespace():
    raw = "Dose:    10  mg   once    daily"
    expected = "dose: 10 mg once daily"
    assert clean_text(raw) == expected


def test_remove_control_noise():
    raw = "Dose \ufffd 10 mg"
    expected = "dose 10 mg"  # the replacement char and extra space are removed
    assert clean_text(raw) == expected


def test_normalize_newlines():
    raw = "Line 1\r\n\r\n\r\n\r\nLine 2"
    expected = "line 1\n\nline 2"
    assert clean_text(raw) == expected


def test_empty_and_whitespace():
    assert clean_text("") == ""
    assert clean_text("   \n\n   ") == ""


def test_emoji_and_stop_words_removal():
    raw = "The recommended dose is 15 mg daily. 😊 Avoid usage!"
    # 'the', 'is' are stop words. '😊' is an emoji. Case is converted to lower.
    expected = "recommended dose 15 mg daily. avoid usage!"
    assert clean_text(raw) == expected
