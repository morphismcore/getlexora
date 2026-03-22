"""
Ingestion pipeline tests.
"""

from app.ingestion.ingest import DEFAULT_TOPICS, IngestionPipeline


class TestDefaultTopics:
    def test_topics_count(self):
        """Should have 80+ topics covering all law areas."""
        assert len(DEFAULT_TOPICS) >= 80

    def test_topics_unique(self):
        """No duplicate topics."""
        assert len(DEFAULT_TOPICS) == len(set(DEFAULT_TOPICS))

    def test_covers_is_hukuku(self):
        """Should include key employment law topics."""
        topics_str = " ".join(DEFAULT_TOPICS)
        assert "işe iade" in topics_str
        assert "kıdem tazminatı" in topics_str
        assert "iş kazası" in topics_str

    def test_covers_ceza_hukuku(self):
        """Should include criminal law topics."""
        topics_str = " ".join(DEFAULT_TOPICS)
        assert "hırsızlık" in topics_str
        assert "dolandırıcılık" in topics_str

    def test_covers_aile_hukuku(self):
        """Should include family law topics."""
        topics_str = " ".join(DEFAULT_TOPICS)
        assert "boşanma" in topics_str
        assert "velayet" in topics_str
        assert "nafaka" in topics_str

    def test_covers_ticaret_hukuku(self):
        """Should include commercial law topics."""
        topics_str = " ".join(DEFAULT_TOPICS)
        assert "çek" in topics_str
        assert "iflas" in topics_str or "konkordato" in topics_str

    def test_covers_idare_hukuku(self):
        """Should include administrative law topics."""
        topics_str = " ".join(DEFAULT_TOPICS)
        assert "idari işlem" in topics_str
        assert "kamulaştırma" in topics_str


class TestIngestionPipelineCheckpoint:
    def test_generate_id_deterministic(self):
        """Same input should always produce same ID."""
        pipeline = IngestionPipeline.__new__(IngestionPipeline)
        id1 = pipeline._generate_id("test-key-123")
        id2 = pipeline._generate_id("test-key-123")
        assert id1 == id2

    def test_generate_id_unique(self):
        """Different inputs should produce different IDs."""
        pipeline = IngestionPipeline.__new__(IngestionPipeline)
        id1 = pipeline._generate_id("key-a")
        id2 = pipeline._generate_id("key-b")
        assert id1 != id2