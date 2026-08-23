<div align="center">

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

<video controls poster="https://raw.githubusercontent.com/mohanapriyan2006/MediMei-RAG-chatbot/main/frontend/src/assets/demo/demo-video-thumbnail.jpeg" width="100%">
  <source src="https://raw.githubusercontent.com/mohanapriyan2006/MediMei-RAG-chatbot/main/frontend/src/assets/demo/demo-video.mp4" type="video/mp4">
  Your browser does not support the video tag. You can <a href="https://raw.githubusercontent.com/mohanapriyan2006/MediMei-RAG-chatbot/main/frontend/src/assets/demo/demo-video.mp4">download the demo video here</a>.
</video>

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
