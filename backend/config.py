import os
import torch
import logging

log = logging.getLogger("FreeTranslate")

# ── Env Configurations ─────────────────────────────────────────────────────
HF_TOKEN = os.environ.get("HF_TOKEN")
CT2_MODELS_DIR = os.environ.get("CT2_MODELS_DIR", "./ct2_models")

# ── Model Registry ──────────────────────────────────────────────────────────
MODEL_REGISTRY = {
    "nllb_600M": {
        "label": "NLLB 200 Distilled 600M",
        "hf_repo": "facebook/nllb-200-distilled-600M",
        "ct2_repo": "facebook/nllb-200-distilled-600M",
        "tokenizer_repo": "facebook/nllb-200-distilled-600M",
        "family": "nllb",
        "default_source": "eng_Latn",
        "default_target": "arb_Arab",
    },
    "nllb_1_3B": {
        "label": "NLLB 200 1.3B",
        "hf_repo": "facebook/nllb-200-1.3B",
        "ct2_repo": "facebook/nllb-200-1.3B",
        "tokenizer_repo": "facebook/nllb-200-1.3B",
        "family": "nllb",
        "default_source": "eng_Latn",
        "default_target": "arb_Arab",
    },
}

# ── Language Lists ─────────────────────────────────────────────────────────
FAMILY_LANGUAGES = {
    "m2m100": {
        "af": "Afrikaans", "am": "Amharic", "ar": "Arabic", "ast": "Asturian",
        "az": "Azerbaijani", "ba": "Bashkir", "be": "Belarusian", "bg": "Bulgarian",
        "bn": "Bengali", "br": "Breton", "bs": "Bosnian", "ca": "Catalan",
        "ceb": "Cebuano", "cs": "Czech", "cy": "Welsh", "da": "Danish",
        "de": "German", "el": "Greek", "en": "English", "es": "Spanish",
        "et": "Estonian", "fa": "Persian", "ff": "Fulah", "fi": "Finnish",
        "fr": "French", "fy": "Western Frisian", "ga": "Irish", "gd": "Scottish Gaelic",
        "gl": "Galician", "gu": "Gujarati", "ha": "Hausa", "he": "Hebrew",
        "hi": "Hindi", "hr": "Croatian", "ht": "Haitian Creole", "hu": "Hungarian",
        "hy": "Armenian", "id": "Indonesian", "ig": "Igbo", "ilo": "Ilocano",
        "is": "Icelandic", "it": "Italian", "ja": "Japanese", "jv": "Javanese",
        "ka": "Georgian", "kk": "Kazakh", "km": "Khmer", "kn": "Kannada",
        "ko": "Korean", "lb": "Luxembourgish", "lg": "Ganda", "ln": "Lingala",
        "lo": "Lao", "lt": "Lithuanian", "lv": "Latvian", "mg": "Malagasy",
        "mk": "Macedonian", "ml": "Malayalam", "mn": "Mongolian", "mr": "Marathi",
        "ms": "Malay", "my": "Burmese", "ne": "Nepali", "nl": "Dutch",
        "no": "Norwegian", "ns": "Northern Sotho", "oc": "Occitan", "or": "Oriya",
        "pa": "Punjabi", "pl": "Polish", "ps": "Pashto", "pt": "Portuguese",
        "ro": "Romanian", "ru": "Russian", "sd": "Sindhi", "si": "Sinhala",
        "sk": "Slovak", "sl": "Slovenian", "so": "Somali", "sq": "Albanian",
        "sr": "Serbian", "ss": "Swati", "su": "Sundanese", "sv": "Swedish",
        "sw": "Swahili", "ta": "Tamil", "th": "Thai", "tl": "Tagalog",
        "tn": "Tswana", "tr": "Turkish", "uk": "Ukrainian", "ur": "Urdu",
        "uz": "Uzbek", "vi": "Vietnamese", "wo": "Wolof", "xh": "Xhosa",
        "yi": "Yiddish", "yo": "Yoruba", "zh": "Chinese", "zu": "Zulu",
    },
    "nllb": {
        "ace_Arab": "Acehnese (Arabic)", "ace_Latn": "Acehnese (Latin)",
        "acm_Arab": "Mesopotamian Arabic", "acq_Arab": "Ta'izzi-Adeni Arabic",
        "aeb_Arab": "Tunisian Arabic", "afr_Latn": "Afrikaans",
        "ajp_Arab": "South Levantine Arabic", "aka_Latn": "Akan",
        "amh_Ethi": "Amharic", "apc_Arab": "North Levantine Arabic",
        "arb_Arab": "Modern Standard Arabic", "ars_Arab": "Najdi Arabic",
        "ary_Arab": "Moroccan Arabic", "arz_Arab": "Egyptian Arabic",
        "asm_Beng": "Assamese", "ast_Latn": "Asturian", "awa_Deva": "Awadhi",
        "ayr_Latn": "Central Aymara", "azb_Arab": "South Azerbaijani",
        "azj_Latn": "North Azerbaijani", "bak_Cyrl": "Bashkir", "bam_Latn": "Bambara",
        "ban_Latn": "Balinese", "bel_Cyrl": "Belarusian", "bem_Latn": "Bemba",
        "ben_Beng": "Bengali", "bho_Deva": "Bhojpuri", "bjn_Arab": "Banjar (Arabic)",
        "bjn_Latn": "Banjar (Latin)", "bod_Tibt": "Standard Tibetan", "bos_Latn": "Bosnian",
        "bug_Latn": "Buginese", "bul_Cyrl": "Bulgarian", "cat_Latn": "Catalan",
        "ceb_Latn": "Cebuano", "ces_Latn": "Czech", "cjk_Latn": "Chokwe",
        "ckb_Arab": "Central Kurdish", "crh_Latn": "Crimean Tatar", "cym_Latn": "Welsh",
        "dan_Latn": "Danish", "deu_Latn": "German", "dik_Latn": "Southwestern Dinka",
        "dyu_Latn": "Dyula", "dzo_Tibt": "Dzongkha", "ell_Grek": "Greek",
        "eng_Latn": "English", "epo_Latn": "Esperanto", "est_Latn": "Estonian",
        "eus_Latn": "Basque", "ewe_Latn": "Ewe", "fao_Latn": "Faroese",
        "pes_Arab": "Iranian Persian", "fij_Latn": "Fijian", "fin_Latn": "Finnish",
        "fon_Latn": "Fon", "fra_Latn": "French", "fur_Latn": "Friulian",
        "fuv_Latn": "Nigerian Fulfulde", "gaz_Latn": "West Central Oromo",
        "gla_Latn": "Scottish Gaelic", "gle_Latn": "Irish", "glg_Latn": "Galician",
        "grn_Latn": "Guarani", "guj_Gujr": "Gujarati", "hat_Latn": "Haitian Creole",
        "hau_Latn": "Hausa", "heb_Hebr": "Hebrew", "hin_Deva": "Hindi",
        "hne_Deva": "Chhattisgarhi", "hrv_Latn": "Croatian", "hun_Latn": "Hungarian",
        "hye_Armn": "Armenian", "ibo_Latn": "Igbo", "isl_Latn": "Icelandic",
        "ita_Latn": "Italian", "jav_Latn": "Javanese", "jpn_Jpan": "Japanese",
        "kab_Latn": "Kabyle", "kac_Latn": "Jingpho", "kam_Latn": "Kamba",
        "kan_Knda": "Kannada", "kas_Arab": "Kashmiri (Arabic)", "kas_Deva": "Kashmiri (Devanagari)",
        "kat_Geor": "Georgian", "knc_Arab": "Central Kanuri (Arabic)", "knc_Latn": "Central Kanuri (Latin)",
        "kaz_Cyrl": "Kazakh", "kbp_Latn": "Kabiyè", "kea_Latn": "Kabuverdianu",
        "khm_Khmr": "Khmer", "kik_Latn": "Kikuyu", "kin_Latn": "Kinyarwanda",
        "kir_Cyrl": "Kyrgyz", "kln_Latn": "Kalaallisut", "kor_Hang": "Korean",
        "kmb_Latn": "Kimbundu", "kon_Latn": "Kikongo", "lao_Laoo": "Lao",
        "lij_Latn": "Ligurian", "lim_Latn": "Limburgish", "lin_Latn": "Lingala",
        "lit_Latn": "Lithuanian", "lmo_Latn": "Lombard", "ltg_Latn": "Latgalian",
        "ltz_Latn": "Luxembourgish", "lua_Latn": "Luba-Kasai", "lug_Latn": "Ganda",
        "luo_Latn": "Luo", "lus_Latn": "Mizo", "lvs_Latn": "Standard Latvian",
        "mag_Deva": "Magahi", "mai_Deva": "Maithili", "mal_Mlym": "Malayalam",
        "mar_Deva": "Marathi", "min_Arab": "Minangkabau (Arabic)", "min_Latn": "Minangkabau (Latin)",
        "mkd_Cyrl": "Macedonian", "plt_Latn": "Plateau Malagasy", "mlt_Latn": "Maltese",
        "mni_Beng": "Meitei", "khk_Cyrl": "Halh Mongolian", "mos_Latn": "Mossi",
        "mri_Latn": "Maori", "mya_Mymr": "Burmese", "nld_Latn": "Dutch",
        "nno_Latn": "Norwegian Nynorsk", "nob_Latn": "Norwegian Bokmål", "npi_Deva": "Nepali",
        "nso_Latn": "Northern Sotho", "nus_Latn": "Nuer", "nya_Latn": "Nyanja",
        "oci_Latn": "Occitan", "ory_Orya": "Odia", "pag_Latn": "Pangasinan",
        "pan_Guru": "Eastern Panjabi", "pap_Latn": "Papiamento", "pol_Latn": "Polish",
        "por_Latn": "Portuguese", "prs_Arab": "Dari", "pbt_Arab": "Southern Pashto",
        "quy_Latn": "Ayacucho Quechua", "ron_Latn": "Romanian", "run_Latn": "Rundi",
        "rus_Cyrl": "Russian", "sag_Latn": "Sango", "san_Deva": "Sanskrit",
        "sat_Olck": "Santali", "scn_Latn": "Sicilian", "shn_Mymr": "Shan",
        "sin_Sinh": "Sinhala", "slk_Latn": "Slovak", "slv_Latn": "Slovenian",
        "smo_Latn": "Samoan", "sna_Latn": "Shona", "snd_Arab": "Sindhi",
        "som_Latn": "Somali", "sot_Latn": "Southern Sotho", "spa_Latn": "Spanish",
        "als_Latn": "Tosk Albanian", "srd_Latn": "Sardinian", "srp_Cyrl": "Serbian",
        "ssw_Latn": "Swati", "sun_Latn": "Sundanese", "swe_Latn": "Swedish",
        "swh_Latn": "Swahili", "szl_Latn": "Silesian", "tam_Taml": "Tamil",
        "tat_Cyrl": "Tatar", "tel_Telu": "Telugu", "tgk_Cyrl": "Tajik",
        "tgl_Latn": "Tagalog", "tha_Thai": "Thai", "tir_Ethi": "Tigrinya",
        "taq_Latn": "Tamasheq (Latin)", "taq_Tfng": "Tamasheq (Tifinagh)",
        "tpi_Latn": "Tok Pisin", "tsn_Latn": "Tswana", "tso_Latn": "Tsonga",
        "tuk_Latn": "Turkmen", "tum_Latn": "Tumbuka", "tur_Latn": "Turkish",
        "twi_Latn": "Twi", "tzm_Tfng": "Central Atlas Tamazight", "uig_Arab": "Uyghur",
        "ukr_Cyrl": "Ukrainian", "umb_Latn": "Umbundu", "urd_Arab": "Urdu",
        "uzn_Latn": "Northern Uzbek", "vec_Latn": "Venetian", "vie_Latn": "Vietnamese",
        "war_Latn": "Waray", "wol_Latn": "Wolof", "xho_Latn": "Xhosa",
        "ydd_Hebr": "Eastern Yiddish", "yor_Latn": "Yoruba", "yue_Hant": "Yue Chinese",
        "zho_Hans": "Chinese (Simplified)", "zho_Hant": "Chinese (Traditional)",
        "zul_Latn": "Zulu",
    },
    "opus": {
        "en": "English",
        "ar": "Arabic",
    },
}

# ── ISO Detection Mappings ──────────────────────────────────────────────────
ISO_TO_NLLB = {
    "af": "afr_Latn", "am": "amh_Ethi", "ar": "arb_Arab", "az": "azj_Latn",
    "be": "bel_Cyrl", "bg": "bul_Cyrl", "bn": "ben_Beng", "bs": "bos_Latn",
    "ca": "cat_Latn", "cs": "ces_Latn", "cy": "cym_Latn", "da": "dan_Latn",
    "de": "deu_Latn", "el": "ell_Grek", "en": "eng_Latn", "es": "spa_Latn",
    "et": "est_Latn", "eu": "eus_Latn", "fa": "pes_Arab", "fi": "fin_Latn",
    "fr": "fra_Latn", "ga": "gle_Latn", "gl": "glg_Latn", "gu": "guj_Gujr",
    "ha": "hau_Latn", "he": "heb_Hebr", "hi": "hin_Deva", "hr": "hrv_Latn",
    "hu": "hun_Latn", "hy": "hye_Armn", "id": "ind_Latn", "ig": "ibo_Latn",
    "is": "isl_Latn", "it": "ita_Latn", "ja": "jpn_Jpan", "ka": "kat_Geor",
    "kk": "kaz_Cyrl", "km": "khm_Khmr", "kn": "kan_Knda", "ko": "kor_Hang",
    "lt": "lit_Latn", "lv": "lvs_Latn", "mk": "mkd_Cyrl", "ml": "mal_Mlym",
    "mn": "khk_Cyrl", "mr": "mar_Deva", "ms": "zsm_Latn", "mt": "mlt_Latn",
    "my": "mya_Mymr", "ne": "npi_Deva", "nl": "nld_Latn", "no": "nob_Latn",
    "or": "ory_Orya", "pa": "pan_Guru", "pl": "pol_Latn", "ps": "pbt_Arab",
    "pt": "por_Latn", "ro": "ron_Latn", "ru": "rus_Cyrl", "sd": "snd_Arab",
    "si": "sin_Sinh", "sk": "slk_Latn", "sl": "slv_Latn", "so": "som_Latn",
    "sq": "als_Latn", "sr": "srp_Cyrl", "sv": "swe_Latn", "sw": "swh_Latn",
    "ta": "tam_Taml", "te": "tel_Telu", "tg": "tgk_Cyrl", "th": "tha_Thai",
    "tl": "tgl_Latn", "tr": "tur_Latn", "uk": "ukr_Cyrl", "ur": "urd_Arab",
    "uz": "uzn_Latn", "vi": "vie_Latn", "xh": "xho_Latn", "yi": "ydd_Hebr",
    "yo": "yor_Latn", "zh": "zho_Hans", "zu": "zul_Latn",
}

ISO_TO_M2M = {
    "zh": "zh", "bs": "hr", "no": "no", "sr": "sr", "sq": "sq", "gl": "gl",
    "eu": "eu", "ga": "ga", "cy": "cy", "mt": "mt", "is": "is", "mk": "mk",
    "be": "be", "hy": "hy", "ka": "ka", "kk": "kk", "tg": "tg", "uz": "uz",
    "az": "az", "mn": "mn", "km": "km", "my": "my", "ne": "ne", "si": "si",
    "gu": "gu", "pa": "pa", "mr": "mr", "sd": "sd", "ps": "ps", "ha": "ha",
    "ig": "ig", "yo": "yo", "zu": "zu", "xh": "xh", "sw": "sw", "am": "am",
    "so": "so", "af": "af", "mg": "mg", "ht": "ht",
}

# ── General Rules & Defaults ───────────────────────────────────────────────
DEFAULT_MODEL_KEY = "nllb_1_3B"
DEFAULT_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CUDA_AVAILABLE = torch.cuda.is_available()
MIN_DETECT_LEN = 20
MIN_DETECT_PROB = 0.75
