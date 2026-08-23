import logging
import os
from typing import Generator

from app.core.config import settings

logger = logging.getLogger(__name__)

# Cached model instance
_llm_instance = None


class _MockLLMClient:
    """Fallback mock used when no local model can be loaded."""

    def __init__(self, reason: str):
        self.reason = reason

    def __call__(self, prompt, **kwargs):
        return {
            "choices": [
                {
                    "text": f"[Mock LLM] {self.reason}"
                }
            ]
        }


class _LlamaCppClient:
    def __init__(self, model_path: str):
        from llama_cpp import Llama
        n_gpu = settings.LLM_N_GPU_LAYERS if settings.LLM_N_GPU_LAYERS is not None else 0
        self.model = Llama(
            model_path=model_path,
            n_ctx=settings.LLM_N_CTX,
            n_gpu_layers=n_gpu,
            verbose=False,
        )

    def __call__(self, prompt, **kwargs):
        clean_kwargs = {k: v for k, v in kwargs.items() if v is not None}
        return self.model(prompt, **clean_kwargs)


class _Gpt4AllClient:
    def __init__(self, model_path: str):
        from gpt4all import GPT4All
        model_dir = os.path.dirname(model_path)
        model_name = os.path.basename(model_path)
        device = "cuda" if settings.LLM_N_GPU_LAYERS and settings.LLM_N_GPU_LAYERS > 0 else "cpu"
        self.model = GPT4All(
            model_name=model_name,
            model_path=model_dir,
            allow_download=False,
            device=device,
            n_ctx=settings.LLM_N_CTX,
        )

    def __call__(self, prompt, **kwargs):
        gen_kwargs = {}
        if "max_tokens" in kwargs:
            gen_kwargs["max_tokens"] = kwargs["max_tokens"]
        if "temperature" in kwargs:
            gen_kwargs["temp"] = kwargs["temperature"]
        if "top_p" in kwargs:
            gen_kwargs["top_p"] = kwargs["top_p"]
        if "top_k" in kwargs:
            gen_kwargs["top_k"] = kwargs["top_k"]
        text = self.model.generate(prompt, **gen_kwargs)

        # Trim at model control tokens and clean up assistant tags
        for token in ("<|end|>", "<|endoftext|>", "<|user|>", "<|system|>"):
            if token in text:
                text = text.split(token)[0]
        text = text.replace("<|assistant|>", "").strip()

        return {"choices": [{"text": text}]}


class _CTransformersClient:
    def __init__(self, model_path: str):
        from ctransformers import AutoModelForCausalLM
        self.model = AutoModelForCausalLM.from_pretrained(model_path, local_files_only=True)

    def __call__(self, prompt, **kwargs):
        gen_kwargs = {}
        if "max_tokens" in kwargs:
            gen_kwargs["max_new_tokens"] = kwargs["max_tokens"]
        if "temperature" in kwargs:
            gen_kwargs["temperature"] = kwargs["temperature"]
        if "top_p" in kwargs:
            gen_kwargs["top_p"] = kwargs["top_p"]
        text = self.model(prompt, **gen_kwargs)
        return {"choices": [{"text": text}]}


class _GroqClient:
    """Groq API client via OpenAI-compatible endpoint."""

    def __init__(self, api_key: str, model: str):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
        self.model = model

    def __call__(self, prompt, **kwargs):
        max_tokens = kwargs.get("max_tokens") or settings.LLM_MAX_NEW_TOKENS
        temperature = kwargs.get("temperature") if kwargs.get("temperature") is not None else settings.LLM_TEMPERATURE
        top_p = kwargs.get("top_p")
        stop = kwargs.get("stop")
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
            **({"top_p": top_p} if top_p is not None else {}),
            **({"stop": stop} if stop else {}),
        )
        text = completion.choices[0].message.content
        return {"choices": [{"text": text}]}


class _GeminiClient:
    """Google Gemini API client."""

    def __init__(self, api_key: str, model: str):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name=model)

    def __call__(self, prompt, **kwargs):
        from google.generativeai.types import GenerationConfig
        max_tokens = kwargs.get("max_tokens") or settings.LLM_MAX_NEW_TOKENS
        temperature = kwargs.get("temperature") if kwargs.get("temperature") is not None else settings.LLM_TEMPERATURE
        top_p = kwargs.get("top_p")
        stop = kwargs.get("stop")
        config = GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
            **({"top_p": top_p} if top_p is not None else {}),
            **({"stop_sequences": stop} if stop else {}),
        )
        response = self.model.generate_content(prompt, generation_config=config)
        try:
            text = response.text
        except Exception as e:
            logger.warning("Gemini response missing text: %s", e)
            text = str(response)
        return {"choices": [{"text": text}]}


class _OpenRouterClient:
    """OpenRouter API client via OpenAI-compatible endpoint."""

    def __init__(self, api_key: str, model: str):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
        self.model = model

    def __call__(self, prompt, **kwargs):
        max_tokens = kwargs.get("max_tokens") or settings.LLM_MAX_NEW_TOKENS
        temperature = kwargs.get("temperature") if kwargs.get("temperature") is not None else settings.LLM_TEMPERATURE
        top_p = kwargs.get("top_p")
        stop = kwargs.get("stop")
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
            **({"top_p": top_p} if top_p is not None else {}),
            **({"stop": stop} if stop else {}),
        )
        text = completion.choices[0].message.content
        return {"choices": [{"text": text}]}


def _load_local_model(model_path: str):
    """Try available GGUF loaders in order of preference."""

    # 1. llama-cpp-python (best, requires compiler on Windows)
    try:
        from llama_cpp import Llama
        logger.info("Loading model with llama_cpp: %s", model_path)
        return _LlamaCppClient(model_path)
    except ImportError:
        logger.info("llama_cpp not installed; trying gpt4all.")
    except Exception as e:
        logger.warning("llama_cpp load failed: %s", e)

    # 2. gpt4all (prebuilt Windows wheels for GGUF)
    try:
        from gpt4all import GPT4All
        logger.info("Loading model with gpt4all: %s", model_path)
        return _Gpt4AllClient(model_path)
    except ImportError:
        logger.info("gpt4all not installed; trying ctransformers.")
    except Exception as e:
        logger.warning("gpt4all load failed: %s", e)

    # 3. ctransformers (lightweight CPU loader)
    try:
        from ctransformers import AutoModelForCausalLM
        logger.info("Loading model with ctransformers: %s", model_path)
        return _CTransformersClient(model_path)
    except Exception as e:
        logger.warning("ctransformers load failed: %s", e)

    raise RuntimeError("No local GGUF loader could load the model.")


def _build_api_client():
    """Try API providers in the configured fallback order."""
    reasons = []

    if settings.GROQ_API_KEY:
        try:
            logger.info("Loading Groq client: %s", settings.GROQ_MODEL)
            return _GroqClient(settings.GROQ_API_KEY, settings.GROQ_MODEL)
        except Exception as e:
            logger.warning("Groq client failed: %s", e)
            reasons.append(f"Groq: {e}")
    else:
        reasons.append("Groq: no API key")

    if settings.GEMINI_API_KEY:
        try:
            logger.info("Loading Gemini client: %s", settings.GEMINI_MODEL)
            return _GeminiClient(settings.GEMINI_API_KEY, settings.GEMINI_MODEL)
        except Exception as e:
            logger.warning("Gemini client failed: %s", e)
            reasons.append(f"Gemini: {e}")
    else:
        reasons.append("Gemini: no API key")

    if settings.OPENROUTER_API_KEY:
        try:
            logger.info("Loading OpenRouter client: %s", settings.OPENROUTER_MODEL)
            return _OpenRouterClient(settings.OPENROUTER_API_KEY, settings.OPENROUTER_MODEL)
        except Exception as e:
            logger.warning("OpenRouter client failed: %s", e)
            reasons.append(f"OpenRouter: {e}")
    else:
        reasons.append("OpenRouter: no API key")

    raise RuntimeError("No API client available: " + "; ".join(reasons))


def get_llm_client():
    """
    Dependency injection helper for the LLM client.
    Caches the provider instance to avoid reinitializing on every request.
    """
    global _llm_instance
    if _llm_instance is not None:
        return _llm_instance

    if settings.USE_LOCAL_LLM:
        model_path = settings.LLM_MODEL_PATH
        if not model_path or not os.path.exists(model_path):
            logger.warning(
                f"LLM model file not found at {model_path}. "
                "Falling back to Mock LLM Client."
            )
            _llm_instance = _MockLLMClient("No local model file found.")
            return _llm_instance

        try:
            _llm_instance = _load_local_model(model_path)
            logger.info("Successfully loaded local LLM from %s", model_path)
        except Exception as e:
            logger.error("Failed to load local LLM: %s. Using mock client.", e)
            _llm_instance = _MockLLMClient(f"Local model failed: {e}")

        return _llm_instance

    try:
        _llm_instance = _build_api_client()
        logger.info("Successfully loaded API LLM client.")
    except Exception as e:
        logger.error("Failed to load API LLM: %s. Using mock client.", e)
        _llm_instance = _MockLLMClient(f"API LLM failed: {e}")

    return _llm_instance
