import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.chunking.chunker import split_text, create_chunks
from app.models.document_page import DocumentPage
from app.models.document import Document
from app.models.chunk import Chunk

def test_split_text_empty():
    assert split_text("") == []
    assert split_text("   ") == []

def test_split_text_small():
    text = "This is a short sentence."
    assert split_text(text) == [text]

def test_split_text_large():
    # CHUNK_SIZE = 1000, CHUNK_OVERLAP = 200
    # Text length 1500 characters
    text = "a" * 1500
    chunks = split_text(text)
    
    assert len(chunks) == 2
    assert len(chunks[0]) == 1000
    # Overlap starts at 1000 - 200 = 800.
    # Second chunk text[800:1800] -> length is 700.
    assert len(chunks[1]) == 700

@pytest.mark.asyncio
async def test_create_chunks_no_pages():
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result
    
    count = await create_chunks("doc-uuid-1", mock_db)
    assert count == 0

@pytest.mark.asyncio
async def test_create_chunks_with_pages():
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    
    # Mocking Document and DocumentPage objects
    mock_doc = Document(document_id="doc-uuid-1", file_name="Test.pdf")
    page1 = DocumentPage(document_id="doc-uuid-1", page_no=1, text_ref="Page 1 text content.")
    page2 = DocumentPage(document_id="doc-uuid-1", page_no=2, text_ref="Page 2 text content.")
    
    # Mocking Chunk objects returned in the final select
    chunk1 = Chunk(document_id="doc-uuid-1", page_no=1, chunk_index=0, chunk_text="Page 1 text content.", chunk_id=101)
    chunk2 = Chunk(document_id="doc-uuid-1", page_no=2, chunk_index=1, chunk_text="Page 2 text content.", chunk_id=102)

    # 1. First db.execute: select Document
    mock_result_doc = MagicMock()
    mock_result_doc.scalar_one_or_none.return_value = mock_doc
    
    # 2. Second db.execute: select DocumentPage
    mock_result_pages = MagicMock()
    mock_result_pages.scalars.return_value.all.return_value = [page1, page2]
    
    # 3. Third db.execute: delete Chunk
    mock_result_delete = MagicMock()
    
    # 4. Fourth db.execute: select Chunk
    mock_result_chunks = MagicMock()
    mock_result_chunks.scalars.return_value.all.return_value = [chunk1, chunk2]
    
    mock_db.execute.side_effect = [
        mock_result_doc,
        mock_result_pages,
        mock_result_delete,
        mock_result_chunks
    ]
    
    count = await create_chunks("doc-uuid-1", mock_db)
    
    assert count == 2
    # Check that execute was called 4 times (select doc, select pages, delete chunks, select chunks)
    assert mock_db.execute.call_count == 4
    assert mock_db.add.call_count == 2
    mock_db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_create_chunks_cleans_and_lowercases():
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    
    mock_doc = Document(document_id="doc-uuid-1", file_name="Test.pdf")
    page1 = DocumentPage(document_id="doc-uuid-1", page_no=1, text_ref="The Dosage is 10 mg. 😊")
    
    mock_result_doc = MagicMock()
    mock_result_doc.scalar_one_or_none.return_value = mock_doc
    
    mock_result_pages = MagicMock()
    mock_result_pages.scalars.return_value.all.return_value = [page1]
    
    mock_result_delete = MagicMock()
    
    # We will check the object added to the DB
    mock_db.execute.side_effect = [
        mock_result_doc,
        mock_result_pages,
        mock_result_delete,
        MagicMock() # for chunks select at end
    ]
    
    await create_chunks("doc-uuid-1", mock_db)
    
    # Check what was added
    mock_db.add.assert_called_once()
    added_chunk = mock_db.add.call_args[0][0]
    
    # "The Dosage is 10 mg. 😊" -> 'is' and 'the' are stop words, 😊 is removed, converted to lowercase
    # Result: "dosage 10 mg."
    assert added_chunk.chunk_text == "dosage 10 mg."

