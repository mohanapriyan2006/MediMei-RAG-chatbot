import pytest
from unittest.mock import MagicMock, patch
from app.services.llm.llm_service import LLMService, _safe_next


def test_safe_next_normal():
    class DummyIterator:
        def __init__(self):
            self.items = [1, 2]
            self.index = 0

        def __next__(self):
            if self.index >= len(self.items):
                raise StopIteration
            val = self.items[self.index]
            self.index += 1
            return val

    iterator = DummyIterator()
    assert _safe_next(iterator) == 1
    assert _safe_next(iterator) == 2
    assert _safe_next(iterator) is None


@pytest.mark.asyncio
async def test_llm_service_streaming_success():
    # Mocking client that returns an iterator (stream)
    class DummyStream:
        def __init__(self):
            self.tokens = ["Hello", " ", "World"]
            self.index = 0

        def __next__(self):
            if self.index >= len(self.tokens):
                raise StopIteration
            val = self.tokens[self.index]
            self.index += 1
            return {"choices": [{"text": val}]}

    mock_client = MagicMock(return_value=DummyStream())
    service = LLMService(client=mock_client)

    result = await service.generate_async("Test prompt")
    assert result["text"] == "Hello World"
    assert result["thinking"] == ""
    mock_client.assert_called_once()
