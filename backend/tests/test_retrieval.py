from app.services.retrieval import passages, retrieve


def test_four_explicit_demo_documents():
    corpus = passages()
    assert len(corpus) == 12
    assert {p.document_id for p in corpus} == {
        "employee-handbook",
        "leave-policy",
        "it-support-guide",
        "vpn-setup-guide",
    }


def test_arabic_leave_retrieval_contains_the_actual_request_procedure():
    hits = retrieve("كيف أطلب إجازة سنوية؟")
    assert hits
    assert any("خمسة أيام عمل" in h.passage.text for h in hits)
    assert all(h.score > 0 for h in hits)


def test_mixed_vpn_question_retrieves_access_procedure():
    hits = retrieve("كيف أطلب صلاحية VPN؟")
    assert any(
        h.passage.document_id == "vpn-setup-guide" and "طلب صلاحية" in h.passage.section
        for h in hits
    )


def test_english_entitlement_retrieves_annual_leave():
    assert any("21" in h.passage.text for h in retrieve("How many annual leave days?"))


def test_unknown_question_has_no_context():
    assert retrieve("ما راتب الرئيس التنفيذي؟") == []
    assert retrieve("quantum banana spaceship") == []


def test_retrieval_is_deterministic_and_limited():
    assert retrieve("VPN setup") == retrieve("VPN setup")
    assert len(retrieve("VPN setup", limit=1)) == 1
