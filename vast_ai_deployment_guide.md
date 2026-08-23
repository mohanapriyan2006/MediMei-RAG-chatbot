# Vast.ai Backend & Database Deployment Guide

This guide contains the step-by-step instructions and commands used to set up the **MediMei** backend (FastAPI), **MySQL (MariaDB)** database, **Qdrant** (Vector DB), and **Cloudflare Tunnel** (for Vercel integration) on a **Vast.ai** GPU instance.

---

## Prerequisites (Run on Local PC)

To enable local browser testing and frontend integration, you must configure SSH keys on your Vast.ai console first.

### 1. Generate SSH Key on Local Windows PC
Open Command Prompt/PowerShell and run:
```cmd
ssh-keygen -t ed25519
```
*(Press Enter to accept the defaults and skip setting a passphrase).*

### 2. Retrieve Public Key
Print the public key to copy it:
* **Command Prompt:** `type %USERPROFILE%\.ssh\id_ed25519.pub`
* **PowerShell:** `cat ~/.ssh/id_ed25519.pub`

*Copy the output and add it to your Vast.ai Account/Instance settings.*

---

## Step 1: Connect via SSH (Local PC Terminal)
Run the SSH connection command shown in your Vast.ai dashboard, but append the port forwarding parameters so you can access the FastAPI and Qdrant local endpoints:

```bash
ssh -p [YOUR_PORT] root@[YOUR_IP] -L 8000:localhost:8000 -L 6333:localhost:6333
```
*Replace `[YOUR_PORT]` and `[YOUR_IP]` with the credentials displayed in the "Connect" button of your Vast.ai console.*

---

## Step 2: Navigate and Clone Repository (Vast.ai Terminal)
Create a persistent subdirectory inside `/workspace` and clone the codebase:

```bash
cd /workspace
git clone https://github.com/Mithil2305/drug-information-chatbot.git drug-chatbot
cd drug-chatbot
```

---

## Step 3: Install Linux System Dependencies (Vast.ai Terminal)
Install MariaDB (MySQL drop-in) and dependencies required for PaddleOCR and general compilation:

```bash
apt-get update && apt-get install -y \
  libgl1-mesa-glx \
  libgomp1 \
  mariadb-server \
  mariadb-client \
  git \
  curl \
  wget \
  build-essential
```

---

## Step 4: Install Python Dependencies & Compile GPU `llama-cpp-python`
Navigate to the backend directory, install requirements, and compile the local LLM package with CUDA bindings:

```bash
cd /workspace/drug-chatbot/backend
pip install -r requirements.txt

# Compile llama-cpp-python with CUDA support
CMAKE_ARGS="-DLLAMA_CUDA=on" pip install llama-cpp-python --force-reinstall --no-cache-dir
```

---

## Step 5: Start & Configure MariaDB (MySQL)
Since systemd service commands are often restricted inside Docker containers, start the daemon directly in the background and configure the database and credentials:

```bash
# 1. Start the MySQL daemon in the background
mysqld_safe --user=mysql &
# (Press Enter if output pauses the terminal prompt)

# 2. Set root password
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'medimei123'; FLUSH PRIVILEGES;"

# 3. Create the backend database
mysql -u root -pmedimei123 -e "CREATE DATABASE IF NOT EXISTS MediMei;"
```

---

## Step 6: Start Qdrant Standalone (Vector Database)
Since running Docker inside a Vast.ai container is restricted, download and run the standalone Qdrant binary:

```bash
# 1. Create a directory for Qdrant
mkdir -p /workspace/qdrant
cd /workspace/qdrant

# 2. Download and unpack Qdrant binary
wget https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz
tar -xzf qdrant-x86_64-unknown-linux-gnu.tar.gz
rm qdrant-x86_64-unknown-linux-gnu.tar.gz

# 3. Create persistent storage directory
mkdir -p /workspace/qdrant/storage

# 4. Start Qdrant in the background (will default save data inside this directory)
nohup ./qdrant > qdrant.log 2>&1 &

# 5. Verify Qdrant is running
curl http://localhost:6333
```

---

## Step 7: Download the Local LLM GGUF Weights
Navigate to the models folder and download your Qwen3.5 4B model (using the raw `resolve` endpoint on Hugging Face):

```bash
# 1. Create LLM folder structure
mkdir -p /workspace/drug-chatbot/backend/data/models/llm
cd /workspace/drug-chatbot/backend/data/models/llm

# 2. Download raw GGUF file
wget https://huggingface.org/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf
```

---

## Step 8: Configure Environment Variables
Create the environment configuration file:
```bash
nano /workspace/drug-chatbot/backend/.env
```

Paste the following configurations (ensuring your database password matches and GGUF path points to the downloaded file):

```env
APP_NAME=MediMei
ENVIRONMENT=production

# MySQL Database Settings (MariaDB running locally)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=MediMei
MYSQL_USER=root
MYSQL_PASSWORD=medimei123

# Qdrant Vector DB Settings
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=drug_documents

# JWT Security Settings
JWT_SECRET_KEY=medimei_super_secure_production_secret_key_12345
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Model Settings
EMBEDDING_DEVICE=cuda
LLM_DEVICE=cuda
LLM_N_GPU_LAYERS=-1  # Offloads ALL LLM layers to the GPU
LLM_MODEL_PATH=/workspace/drug-chatbot/backend/data/models/llm/Qwen3.5-4B-Q4_K_M.gguf
```
*(Press `Ctrl+O` then `Enter` to save, and `Ctrl+X` to exit)*

---

## Step 9: Run Database Migrations
Run your alembic migrations to create the database schemas. Be sure to pass `PYTHONPATH=.` so python can locate the `app` package:

```bash
cd /workspace/drug-chatbot/backend
PYTHONPATH=. alembic upgrade head
```

---

## Step 10: Run the FastAPI Server
Start your FastAPI backend:

```bash
cd /workspace/drug-chatbot/backend
PYTHONPATH=. python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Step 11: Set Up Cloudflare Tunnel (For Vercel Integration)
Since Vercel serves the frontend over secure **HTTPS**, it blocks standard **HTTP** backend connections. Set up a free Cloudflare Tunnel on your server:

```bash
# 1. Download Cloudflare tunnel binary
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /workspace/cloudflared
chmod +x /workspace/cloudflared

# 2. Run the tunnel in the background
nohup /workspace/cloudflared tunnel --url http://localhost:8000 > /workspace/tunnel.log 2>&1 &

# 3. Retrieve the generated HTTPS URL
grep trycloudflare /workspace/tunnel.log
```

Copy the generated `https://[name].trycloudflare.com` URL and update the **`VITE_API_URL`** environment variable inside your **Vercel dashboard**, then redeploy.
