<div align="center">


<img alt="logo" src="./frontend/public/logo.png" height=100 />

# MediMei

## Evidence-First Drug Information Assistant

**We don't guess. We show the proof.**

MediMei is a RAG-based clinical assistant that answers natural-language drug questions using only your uploaded medical documents and shows exactly where the answer came from.

[Live Preview](https://medimei-ai.vercel.app/) · [Demo Video](#demo-video) · [Screenshots](#screenshots) · [Architecture](#architecture)

</div>

---

## What is MediMei?

MediMei helps clinicians, pharmacists, and researchers get evidence-backed answers from pharmaceutical label documents. Upload PDFs, DOCX files, or drug labels, ask a question, and MediMei will retrieve the most relevant passages, generate a grounded response, and cite the exact page and section of the source.

Built for the **Cognizant NPN Hackathon 2026, Use Case 7**.

---

## Demo Video

## Demo Video
[![Demo Video](https://raw.githubusercontent.com/mohanapriyan2006/MediMei-RAG-chatbot/main/frontend/src/assets/demo/demo-video-thumbnail.jpeg)](https://raw.githubusercontent.com/mohanapriyan2006/MediMei-RAG-chatbot/main/frontend/src/assets/demo/demo-video.mp4)


---

## Screenshots

### Desktop

<div align="center">
  <img src="./screenshots/pc/hero.jpeg" alt="MediMei Hero" width="49%" />
  <img src="./screenshots/pc/chatspace.jpeg" alt="MediMei Chat" width="49%" />
  <img src="./screenshots/pc/documents.jpeg" alt="Document Manager" width="49%" />
  <img src="./screenshots/pc/memory-dark.jpeg" alt="Memory Page" width="49%" />
</div>

### Mobile

<div align="center">
  <img src="./screenshots/mobile/hero.jpeg" alt="Mobile Hero" width="24%" />
  <img src="./screenshots/mobile/chatspace.jpeg" alt="Mobile Chat" width="24%" />
  <img src="./screenshots/mobile/documents.jpeg" alt="Mobile Documents" width="24%" />
  <img src="./screenshots/mobile/memory.jpeg" alt="Mobile Memory" width="24%" />
</div>

---

## Core Features

- **Evidence-First RAG** — Every answer is grounded in your uploaded documents.
- **Page-Level Citations** — Click any citation to jump to the exact source page.
- **No Hallucinations** — When the evidence is not there, MediMei says so.
- **Drug Comparison** — Compare two drugs side-by-side across indications, dosage, warnings, contraindications, adverse reactions, and special populations.
- **Memory** — Save important facts and preferences so the assistant remembers context across sessions.
- **OCR & Document Parsing** — Extract text and tables from PDFs, DOCX, and image-based labels.
- **Secure & Private** — Documents stay isolated per user and are never shared externally.

---

## Architecture

MediMei is built as a full-stack RAG pipeline with a separate frontend-only preview option.

### Full-Stack Pipeline

Ingestion → Extraction/OCR → Chunking → Embeddings → Vector Retrieval → Context Building → AI Generation → Citation Mapping

```mermaid
flowchart TD

subgraph group_frontend["React SPA"]
  node_spa["React application<br/>Vite SPA<br/>[App.tsx]"]
  node_client_state["Client state<br/>contexts<br/>[ChatContext.tsx]"]
  node_api_client["API client<br/>HTTP client<br/>[client.ts]"]
  node_frontend_entry["Frontend entry<br/>browser entry<br/>[main.tsx]"]
end

subgraph group_backend["FastAPI Backend"]
  node_fastapi_app["FastAPI application<br/>composition root<br/>[main.py]"]
  node_api_router["API router<br/>HTTP boundary<br/>[router.py]"]
  node_chat_api["Chat endpoint<br/>route handler<br/>[chat.py]"]
  node_ingestion_pipeline["Document pipeline<br/>ingestion pipeline<br/>[pipeline.py]"]
  node_chunker["Chunk builder<br/>chunking service<br/>[chunker.py]"]
  node_indexer["Embedding indexer<br/>indexing service<br/>[indexer_service.py]"]
  node_rag_service{{"RAG service<br/>answer orchestration<br/>[rag_service.py]"}}
  node_hybrid_search["Hybrid retrieval<br/>retrieval service<br/>[hybrid_search.py]"]
  node_grounding_validator["Grounding validation<br/>safety boundary"]
  node_llm_client["LLM client<br/>Qwen integration<br/>[client.py]"]
  node_comparison_service["Comparison service<br/>drug comparison"]
  node_memory_service["Memory service<br/>conversation memory<br/>[memory_service.py]"]
  node_task_manager["Task manager<br/>background jobs<br/>[task_manager.py]"]
end

subgraph group_data["Data &amp; AI Infrastructure"]
  node_mysql[("MySQL<br/>relational database<br/>[database.py]")]
  node_qdrant[("Qdrant<br/>vector database")]
  node_uploads["Document artifacts<br/>file storage"]
end

node_frontend_entry -->|"mounts"| node_spa
node_spa -->|"uses"| node_client_state
node_client_state -->|"requests"| node_api_client
node_api_client -->|"HTTP"| node_fastapi_app
node_fastapi_app -->|"registers"| node_api_router
node_api_router -->|"routes chat"| node_chat_api
node_chat_api -->|"answers"| node_rag_service
node_rag_service -->|"retrieves evidence"| node_hybrid_search
node_hybrid_search -->|"semantic search"| node_qdrant
node_rag_service -->|"generates answer"| node_llm_client
node_rag_service -->|"validates output"| node_grounding_validator
node_rag_service -->|"stores citations"| node_mysql
node_ingestion_pipeline -->|"clean source"| node_chunker
node_chunker -->|"metadata chunks"| node_indexer
node_indexer -->|"upserts vectors"| node_qdrant
node_ingestion_pipeline -->|"reads and writes"| node_uploads
node_task_manager -->|"runs asynchronously"| node_ingestion_pipeline
node_api_router -->|"starts and polls"| node_task_manager
node_api_router -->|"comparison requests"| node_comparison_service
node_comparison_service -->|"retrieves evidence"| node_hybrid_search
node_api_router -->|"memory requests"| node_memory_service
node_memory_service -->|"persists memory"| node_mysql
node_ingestion_pipeline -->|"stores document state"| node_mysql

click node_spa "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/frontend/src/App.tsx"
click node_client_state "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/frontend/src/contexts/ChatContext.tsx"
click node_api_client "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/frontend/src/api/client.ts"
click node_frontend_entry "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/frontend/src/main.tsx"
click node_fastapi_app "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/main.py"
click node_api_router "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/api/router.py"
click node_chat_api "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/api/routes/chat.py"
click node_ingestion_pipeline "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/services/pdf/pipeline.py"
click node_chunker "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/services/chunking/chunker.py"
click node_indexer "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/services/retrieval/indexer_service.py"
click node_rag_service "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/services/chat/rag_service.py"
click node_hybrid_search "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/services/retrieval/hybrid_search.py"
click node_grounding_validator "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/services/validation/grounding_validator.py"
click node_llm_client "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/services/llm/client.py"
click node_comparison_service "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/services/comparison/comparison_service.py"
click node_memory_service "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/services/chat/memory_service.py"
click node_task_manager "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/core/task_manager.py"
click node_mysql "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/db/database.py"
click node_qdrant "https://github.com/mohanapriyan2006/medimei-rag-chatbot/blob/main/backend/app/repositories/qdrant_repository.py"
click node_uploads "https://github.com/mohanapriyan2006/medimei-rag-chatbot/tree/main/data/uploads"

classDef toneNeutral fill:#f8fafc,stroke:#334155,stroke-width:1.5px,color:#0f172a
classDef toneBlue fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#172554
classDef toneAmber fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f
classDef toneMint fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d
classDef toneRose fill:#ffe4e6,stroke:#e11d48,stroke-width:1.5px,color:#881337
classDef toneIndigo fill:#e0e7ff,stroke:#4f46e5,stroke-width:1.5px,color:#312e81
classDef toneTeal fill:#ccfbf1,stroke:#0f766e,stroke-width:1.5px,color:#134e4a
class node_spa,node_client_state,node_api_client,node_frontend_entry toneBlue
class node_fastapi_app,node_api_router,node_chat_api,node_ingestion_pipeline,node_chunker,node_indexer,node_rag_service,node_hybrid_search,node_grounding_validator,node_llm_client,node_comparison_service,node_memory_service,node_task_manager toneAmber
class node_mysql,node_qdrant,node_uploads toneMint
```

### Database Design

<div align="center">
  <img src="./frontend/src/assets/demo/ER-diagram.png" alt="ER Diagram" width="80%" />
</div>

### Presentation

- [Download PPT](./frontend/src/assets/demo/ppt.pdf)

---

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite 6
- Tailwind CSS
- React Router DOM
- Sonner (toasts)

### Backend

- Python
- FastAPI
- MySQL
- Qdrant (vector store)

### AI & RAG

- BGE-M3 embeddings
- Qwen 3.5 4B / Qwen 3.6 27B
- PyMuPDF
- PaddleOCR

### Deployment

- Vercel (frontend preview)
- vast.ai (backend/GPU)

---

## Project Structure

```
MediMei-RAG-chatbot/
├── backend/      # FastAPI + RAG pipeline
├── frontend/     # React + Vite frontend
├── screenshots/  # UI screenshots
└── vercel.json   # Vercel SPA routing config
```

---

## Getting Started

### Frontend (Preview Only)

```bash
cd frontend
cp .env.example .env
# Add VITE_GROQ_API_KEY in .env
npm install
npm run dev
```

For a static Vercel preview:

```bash
npm run build
```

### Backend (Full-Stack)

```bash
cd backend
cp .env.example .env
# Configure Qdrant, MySQL, and model settings
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

---

## Environment Variables

### Frontend Preview

```
VITE_GROQ_API_KEY=your_groq_api_key
```

### Backend

```
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=drug_documents
EMBEDDING_MODEL=BAAI/bge-m3
LLM_MODEL=Qwen/Qwen3.5-4B
DATABASE_URL=mysql+pymysql://user:pass@localhost/medimei
```

---

## Team

- **Mohanapriyan M** — Full Stack Developer | AI & RAG  
  [Portfolio](https://mohanapriyan.dev) · [LinkedIn](https://linkedin.com/in/mohanapriyan-m2006)

- **Mithilesh ES** — Developer | AI & Application Engineering
- **Anand VB** — Developer | Application Engineering
- **Gokulkrishnan M** — Developer | AI & Backend Engineering
- **Harees Ahamed K** — Developer | Application Engineering
- **Kanishkar P** — Developer | AI & Full-Stack Engineering

---

## Mission

> "Answer with evidence. Cite the source. Never guess when the evidence isn't there."

---

## License

This project was developed for the Cognizant NPN Hackathon 2026.
