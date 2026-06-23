import re
import gc
import os
import json
import logging
import asyncio
from typing import Optional, AsyncGenerator

import torch
from backend.config import (
    HF_TOKEN,
    CT2_MODELS_DIR,
    MODEL_REGISTRY,
    MIN_DETECT_LEN,
    MIN_DETECT_PROB,
    ISO_TO_NLLB,
    ISO_TO_M2M,
    DEFAULT_MODEL_KEY,
    DEFAULT_DEVICE
)

log = logging.getLogger("FreeTranslate")

# ── Optional heavy imports (graceful fallback) ─────────────────────────────
try:
    import ctranslate2
    CT2_AVAILABLE = True
except ImportError:
    CT2_AVAILABLE = False
    log.warning("CTranslate2 not installed – falling back to transformers.")

try:
    from transformers import AutoTokenizer
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

try:
    from langdetect import detect as langdetect_detect, DetectorFactory
    DetectorFactory.seed = 0
    LANGDETECT_AVAILABLE = True
except ImportError:
    LANGDETECT_AVAILABLE = False


# ── Engine state ───────────────────────────────────────────────────────────
ENGINE = {
    "model_key": None,
    "device": None,
    "tokenizer": None,
    "translator": None,  # CTranslate2 Translator object
    "model": None,       # HF model fallback
    "family": None,
}


def _ct2_model_path(model_key: str) -> str:
    return os.path.join(CT2_MODELS_DIR, model_key)


def _ensure_ct2_model(model_key: str) -> str:
    """Convert HF model to CTranslate2 format if not already present."""
    path = _ct2_model_path(model_key)
    if os.path.isdir(path) and os.listdir(path):
        return path
    os.makedirs(path, exist_ok=True)
    repo = MODEL_REGISTRY[model_key]["hf_repo"]
    log.info(f"Converting {repo} to CTranslate2 format → {path}")

    try:
        import ctranslate2.converters
        converter = ctranslate2.converters.TransformersConverter(repo)
        converter.convert(output_dir=path, quantization="int8", force=True)
    except Exception as e:
        raise RuntimeError(f"CTranslate2 conversion failed: {e}")

    return path


def get_forced_bos_token_id(tokenizer, lang_code: str) -> int:
    lang_code = lang_code.strip()
    if hasattr(tokenizer, "get_lang_id"):
        try:
            return tokenizer.get_lang_id(lang_code)
        except Exception:
            pass
    if hasattr(tokenizer, "lang_code_to_id") and lang_code in tokenizer.lang_code_to_id:
        return tokenizer.lang_code_to_id[lang_code]
    if hasattr(tokenizer, "convert_tokens_to_ids"):
        token_id = tokenizer.convert_tokens_to_ids(lang_code)
        if token_id is not None and token_id != getattr(tokenizer, "unk_token_id", None):
            return token_id
    raise ValueError(f"Unsupported language code for this tokenizer: {lang_code}")


def split_long_text(text: str, max_chars: int = 500) -> list[str]:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    chunks = []
    for paragraph in text.split("\n"):
        if not paragraph.strip():
            chunks.append("")
            continue
        if len(paragraph) <= max_chars:
            chunks.append(paragraph)
            continue
        sentences = re.split(r"(?<=[.!?؟])\s+", paragraph.strip())
        buf = ""
        for sent in sentences:
            if not sent.strip():
                continue
            if len(sent) > max_chars:
                words = sent.split()
                for word in words:
                    if len(word) > max_chars:
                        if buf:
                            chunks.append(buf)
                            buf = ""
                        for j in range(0, len(word), max_chars):
                            chunks.append(word[j : j + max_chars])
                        continue
                    candidate = f"{buf} {word}".strip() if buf else word
                    if len(candidate) <= max_chars:
                        buf = candidate
                    else:
                        if buf:
                            chunks.append(buf)
                        buf = word
                continue
            candidate = f"{buf} {sent}".strip() if buf else sent
            if len(candidate) <= max_chars:
                buf = candidate
            else:
                if buf:
                    chunks.append(buf)
                buf = sent
        if buf:
            chunks.append(buf)
    return chunks


def detect_language(text: str, family: str = "nllb") -> Optional[str]:
    """
    Detect language and return the model-family-appropriate code.
    """
    if not LANGDETECT_AVAILABLE:
        return None
    stripped = text.strip()
    if len(stripped) < MIN_DETECT_LEN:
        return None  # too short to trust
    try:
        from langdetect import detect_langs
        results = detect_langs(stripped)
        if not results:
            return None
        top = results[0]
        if top.prob < MIN_DETECT_PROB:
            return None  # not confident enough
        iso = str(top.lang).split("-")[0].lower()

        if family == "nllb":
            return ISO_TO_NLLB.get(iso)
        elif family == "m2m100":
            return ISO_TO_M2M.get(iso, iso)
        else:
            return iso
    except Exception:
        return None


def load_engine(model_key: str, device: str) -> dict:
    if model_key not in MODEL_REGISTRY:
        raise ValueError(f"Unknown model key: {model_key}")
    if device == "cuda" and not torch.cuda.is_available():
        raise ValueError("CUDA is not available on this machine.")

    # Cleanup old model
    if ENGINE["translator"] is not None or ENGINE["model"] is not None:
        ENGINE["translator"] = None
        ENGINE["model"] = None
        ENGINE["tokenizer"] = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()

    config = MODEL_REGISTRY[model_key]
    tokenizer_repo = config["tokenizer_repo"]
    family = config["family"]

    log.info(f"Loading tokenizer: {tokenizer_repo}")
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_repo, token=HF_TOKEN)

    if CT2_AVAILABLE:
        ct2_path = _ensure_ct2_model(model_key)
        ct2_device = "cuda" if device == "cuda" else "cpu"
        compute_type = "int8_float16" if device == "cuda" else "int8"
        log.info(f"Loading CTranslate2 model from {ct2_path} on {ct2_device}")
        translator = ctranslate2.Translator(
            ct2_path,
            device=ct2_device,
            inter_threads=2,
            intra_threads=4,
            compute_type=compute_type,
        )
        ENGINE["translator"] = translator
        ENGINE["model"] = None
    else:
        import transformers as tfm
        log.info(f"Loading HF model: {config['hf_repo']} on {device}")
        dtype = torch.float16 if device == "cuda" else torch.float32
        model = tfm.AutoModelForSeq2SeqLM.from_pretrained(
            config["hf_repo"], torch_dtype=dtype, token=HF_TOKEN
        ).to(device)
        model.eval()
        ENGINE["model"] = model
        ENGINE["translator"] = None

    ENGINE["model_key"] = model_key
    ENGINE["device"] = device
    ENGINE["tokenizer"] = tokenizer
    ENGINE["family"] = family

    return {
        "model_key": model_key,
        "device": device,
        "label": config["label"],
        "family": family,
    }


def get_active_engine() -> dict:
    if ENGINE["tokenizer"] is None:
        load_engine(DEFAULT_MODEL_KEY, DEFAULT_DEVICE)
    return ENGINE


def translate_text(
    text: str,
    source_lang: Optional[str],
    target_lang: Optional[str],
) -> tuple[str, bool, str]:
    """Returns (translated_text, was_stopped, resolved_source_lang). Blocking."""
    engine = get_active_engine()
    tokenizer = engine["tokenizer"]
    device = engine["device"]
    model_key = engine["model_key"]
    family = engine["family"]
    config = MODEL_REGISTRY[model_key]

    # Auto-detect source language if not specified
    if not source_lang:
        detected = detect_language(text, family=family)
        source_lang = detected or config["default_source"]
    if not target_lang:
        target_lang = config["default_target"]

    max_chars = 900 if device == "cuda" else 500
    chunks = split_long_text(text, max_chars=max_chars)
    translated_chunks = []

    if engine["translator"] is not None:
        # ── CTranslate2 path ──────────────────────────────────────────────
        translator = engine["translator"]

        if family in ("m2m100", "nllb"):
            tokenizer.src_lang = source_lang

        batch_size = 16 if device == "cuda" else 8
        beam_size = 4 if device == "cuda" else 2
        max_decoding_len = 256

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            blank_mask = [not c.strip() for c in batch]
            to_translate = [c for c in batch if c.strip()]

            if not to_translate:
                translated_chunks.extend([""] * len(batch))
                continue

            if family in ("m2m100", "nllb"):
                tokenized = [
                    tokenizer.convert_ids_to_tokens(tokenizer.encode(t))
                    for t in to_translate
                ]
                target_prefix = [[target_lang]] * len(to_translate)
                results = translator.translate_batch(
                    tokenized,
                    target_prefix=target_prefix,
                    beam_size=beam_size,
                    max_decoding_length=max_decoding_len,
                    no_repeat_ngram_size=4,
                )
            else:
                # opus-mt: simple tokenize → translate
                tokenized = [
                    tokenizer.convert_ids_to_tokens(tokenizer.encode(t))
                    for t in to_translate
                ]
                results = translator.translate_batch(
                    tokenized,
                    beam_size=beam_size,
                    max_decoding_length=max_decoding_len,
                )

            # Build a set of token strings to suppress from output
            special_ids = set()
            for attr in ("all_special_ids",):
                if hasattr(tokenizer, attr):
                    special_ids.update(getattr(tokenizer, attr))
            special_tokens_set = (
                set(tokenizer.convert_ids_to_tokens(list(special_ids)))
                if special_ids
                else set()
            )
            # Also suppress the explicit target lang token and <unk>
            special_tokens_set.add(target_lang)
            special_tokens_set.add("<unk>")
            special_tokens_set.discard(None)

            def _clean_tokens(tokens: list[str]) -> list[str]:
                return [t for t in tokens if t not in special_tokens_set]

            decoded = [
                tokenizer.convert_tokens_to_string(_clean_tokens(r.hypotheses[0]))
                for r in results
            ]
            decoded_iter = iter(decoded)
            for is_blank in blank_mask:
                if is_blank:
                    translated_chunks.append("")
                else:
                    translated_chunks.append(next(decoded_iter, ""))

    else:
        # ── HF transformers fallback ──────────────────────────────────────
        model = engine["model"]
        tokenizer.src_lang = source_lang
        forced_bos_token_id = get_forced_bos_token_id(tokenizer, target_lang)
        batch_size = 12 if device == "cuda" else 6
        num_beams = 3 if device == "cuda" else 1
        max_new_tokens = 192 if device == "cuda" else 128

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            blank_mask = [not c.strip() for c in batch]
            to_translate = [c for c in batch if c.strip()]

            if not to_translate:
                translated_chunks.extend([""] * len(batch))
                continue

            inputs = tokenizer(
                to_translate,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512,
            ).to(device)

            gen_kwargs = {
                "forced_bos_token_id": forced_bos_token_id,
                "do_sample": False,
                "max_new_tokens": max_new_tokens,
            }
            if num_beams > 1:
                gen_kwargs["num_beams"] = num_beams
                gen_kwargs["early_stopping"] = True

            with torch.no_grad():
                outputs = model.generate(**inputs, **gen_kwargs)

            decoded = tokenizer.batch_decode(outputs, skip_special_tokens=True)
            decoded_iter = iter(decoded)
            for is_blank in blank_mask:
                if is_blank:
                    translated_chunks.append("")
                else:
                    translated_chunks.append(next(decoded_iter, ""))

    return "\n".join(translated_chunks).strip(), False, source_lang


async def sse_translate(
    text: str,
    source_lang: Optional[str],
    target_lang: Optional[str],
) -> AsyncGenerator[str, None]:
    """Yields SSE-formatted data events with translated chunks progressively."""
    engine = get_active_engine()
    config = MODEL_REGISTRY[engine["model_key"]]
    source_lang = source_lang or config["default_source"]
    target_lang = target_lang or config["default_target"]

    max_chars = 900 if engine["device"] == "cuda" else 500
    chunks = split_long_text(text, max_chars=max_chars)

    loop = asyncio.get_event_loop()

    def translate_single(chunk: str) -> str:
        result, _, _src = translate_text(chunk, source_lang, target_lang)
        return result

    for chunk in chunks:
        if not chunk.strip():
            yield f"data: {json.dumps({'token': '\n'})}\n\n"
            continue
        result = await loop.run_in_executor(None, translate_single, chunk)
        yield f"data: {json.dumps({'token': result + ' '})}\n\n"

    yield f"data: {json.dumps({'done': True})}\n\n"
