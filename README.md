# FreeTranslate

A production-grade, privacy-first translation application with a premium UI/UX design. FreeTranslate runs entirely locally on your machine, ensuring your text never leaves your device. It features a modern web interface and a browser extension for seamless in-page translation.


## 📺 Demo
## 📺 Demo

<video width="100%" controls>
  <source src="https://github.com/TOTO-sys28/FreeTranslate/raw/main/Assets/demo.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

## ✨ Features

### 🌐 Translation Capabilities
- **200+ Languages**: Support for over 200 languages using Facebook's NLLB-200 models
- **Auto Language Detection**: Automatically detects source language using langdetect
- **Streaming Translation**: Real-time streaming translation for large texts
- **Document Translation**: Translate DOCX, PDF, and TXT files with preserved formatting
- **Batch Processing**: Efficiently handles long texts by splitting into chunks

### 🎨 Premium UI/UX Design
- **Arc Browser-Inspired Theme**: Dark glassmorphism aesthetic with blur effects
- **Neo-Brutalism Theme**: Clean, bold light theme with high contrast
- **Theme Toggle**: Switch between dark and light themes instantly
- **Geist Font**: Modern, clean typography for optimal readability
- **Animated Particle System**: Dynamic background effects in the web interface
- **Custom Dropdowns**: Beautiful custom language selectors matching the design system
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### 🧩 Browser Extension
- **Text Selection Translation**: Highlight any text on a webpage to translate it
- **In-Page Overlay**: Shows translation results in a sleek overlay card
- **Full-Page Translation**: Translate entire web pages with a single click
- **Kill Switch**: Enable/disable full-page translation feature
- **Theme Sync**: Extension UI matches the web application's design themes
- **Local Service**: All translations processed by your local backend

### 🔒 Privacy & Security
- **100% Local**: All processing happens on your machine
- **No Data Transmission**: Your text never leaves your device
- **No API Keys Required**: Uses open-source models running locally
- **Offline Capable**: Works without internet connection after initial model download

### ⚡ Performance
- **GPU Acceleration**: CUDA support for NVIDIA GPUs (automatic detection)
- **CTranslate2**: Optimized inference using CTranslate2 for faster translations
- **Intelligent Batching**: Processes text in batches for optimal performance
- **Memory Efficient**: Automatic garbage collection and model cleanup

## 📋 Requirements

### System Requirements
- **Operating System**: Windows, macOS, or Linux
- **Python**: 3.8 or higher (tested with Python 3.13)
- **RAM**: 8GB minimum (16GB recommended for the default 1.3B model)
- **Storage**: 5GB minimum for models (additional space for converted models)
- **GPU**: NVIDIA GPU with CUDA support (optional, for acceleration)

### Browser Requirements (Extension)
- **Chrome/Edge**: 88 or higher
- **Firefox**: 78 or higher
- **Other Chromium-based browsers**: Brave, Opera, Vivaldi, etc.

## 🚀 Installation

### Option 1: Docker (Recommended)

The easiest way to run FreeTranslate is using Docker. This ensures consistent environments across all platforms.

#### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/TOTO-sys28/FreeTranslate.git
cd FreeTranslate

# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The application will be available at `http://localhost:8000`

#### Using Docker directly

```bash
# Clone the repository
git clone https://github.com/TOTO-sys28/FreeTranslate.git
cd FreeTranslate

# Build the image
docker build -t freetranslate .

# Run the container
docker run -d -p 8000:8000 -v $(pwd)/ct2_models:/app/ct2_models --name freetranslate freetranslate
```

#### GPU Support with Docker

If you have an NVIDIA GPU and want to use GPU acceleration:

1. Install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
2. Uncomment the GPU section in `docker-compose.yml`
3. Run with GPU support:

```bash
docker-compose up -d
```

#### Docker Notes

- Models are downloaded on first run and persisted in the `ct2_models` directory
- The container uses Python 3.11 slim image for efficiency
- Port 8000 is exposed for the web interface and API
- For GPU support, ensure you have nvidia-docker2 installed

### Option 2: Manual Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/TOTO-sys28/FreeTranslate.git
cd FreeTranslate
```

#### 2. Install Python Dependencies

Create a virtual environment (recommended):

```bash
# On Windows
python -m venv venv
venv\Scripts\activate

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

#### 3. (Optional) Set Hugging Face Token

If you want to use models that require authentication:

```bash
# On Windows
set HF_TOKEN=your_token_here

# On macOS/Linux
export HF_TOKEN=your_token_here
```

#### 4. Start the Backend Server

```bash
python -m backend.main
```

The server will start on `http://localhost:8000`

### 5. Access the Web Interface

Open your browser and navigate to:

```
http://localhost:8000
```

### 6. Install the Browser Extension

#### Chrome/Edge/Brave/Opera:
1. Open your browser's extension management page
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
   - Opera: `opera://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder from the FreeTranslate directory

#### Firefox:
1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `extension/manifest.json`

## 📖 Usage

### Web Interface

1. **Select Languages**: Choose source and target languages from the dropdowns
   - Set source to "Auto Detect" for automatic language detection
2. **Enter Text**: Type or paste text in the input area
3. **Translate**: Click the translate button or press Enter
4. **Stream Mode**: Enable streaming for real-time translation of long texts
5. **Theme Toggle**: Click the moon/sun icon to switch between themes
6. **Document Translation**: Upload DOCX, PDF, or TXT files for document translation

### Browser Extension

#### Text Selection Translation
1. Navigate to any webpage
2. Highlight/select text you want to translate
3. A translation overlay will appear automatically
4. View the translation in the overlay card

#### Full-Page Translation
1. Click the extension icon in your browser toolbar
2. In the popup, ensure "Enable Full-Page Translation" is checked
3. Click "Translate Page" to translate the entire webpage
4. Use the kill switch to disable full-page translation when not needed

#### Extension Settings
- **Theme Toggle**: Switch between dark glassmorphism and Neo-Brutalism themes
- **Full-Page Translation Toggle**: Enable or disable the full-page translation feature
- **Language Selection**: Choose default source and target languages

## 🔧 Configuration

### Environment Variables

- `HF_TOKEN`: Hugging Face authentication token (optional, for gated models)
- `CT2_MODELS_DIR`: Directory for CTranslate2 converted models (default: `./ct2_models`)

### Model Configuration

Edit `backend/config.py` to:
- Add new translation models
- Change default model (currently set to `nllb_1_3B`)
- Adjust language mappings
- Modify detection thresholds

**Available Models:**
- `nllb_600M`: Smaller model (600M parameters), faster inference, lower memory usage
- `nllb_1_3B`: Larger model (1.3B parameters), higher quality translations (default)

### Server Configuration

Edit `backend/main.py` to:
- Change host/port (default: `0.0.0.0:8000`)
- Adjust CORS settings
- Modify API endpoints

## 🎯 API Endpoints

### Health Check
```http
GET /api/health
```
Returns server status and active model information.

### Configuration
```http
GET /api/config
```
Returns system configuration including CUDA availability and default settings.

### Supported Languages
```http
GET /api/languages
```
Returns all supported languages for the current model.

### Language Detection
```http
POST /api/detect
Content-Type: application/json

{
  "text": "Your text here"
}
```
Detects the language of the provided text.

### Translation
```http
POST /api/translate
Content-Type: application/json

{
  "text": "Your text here",
  "source_lang": "eng_Latn",
  "target_lang": "arb_Arab",
  "stream": false
}
```
Translates text. Set `stream: true` for streaming responses.

### Document Translation
```http
POST /api/translate/document
Content-Type: multipart/form-data

file: <document>
source_lang: eng_Latn
target_lang: arb_Arab
```
Translates uploaded documents (DOCX, PDF, TXT).

### Model Reload
```http
POST /api/reload
Content-Type: application/json

{
  "model_key": "nllb_1_3B",
  "device": "cuda"
}
```
Reloads the translation engine with specified model and device. Available models: `nllb_600M` and `nllb_1_3B`.

## 🏗️ Project Structure

```
FreeTranslate/
├── backend/
│   ├── __init__.py
│   ├── config.py              # Configuration and model registry
│   ├── main.py                # FastAPI application and endpoints
│   └── services/
│       ├── __init__.py
│       ├── translation_engine.py   # Core translation logic
│       └── document_translator.py   # Document translation
├── frontend/
│   ├── index.html             # Web application HTML
│   ├── style.css              # Styles and themes
│   ├── app.js                 # Frontend logic
│   └── dropdown.js            # Custom dropdown components
├── extension/
│   ├── manifest.json          # Extension manifest
│   ├── background.js          # Background service worker
│   ├── content.js             # Content script for in-page translation
│   ├── content.css            # Content script styles
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup logic
│   ├── dropdown.js            # Custom dropdowns for extension
│   └── icons/                 # Extension icons (16, 32, 48, 128)
├── icons/                     # Application icons (16, 32, 48, 128)
├── ct2_models/                # CTranslate2 converted models (auto-created)
├── favicon.png                # Main favicon
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## 🛠️ Development

### Adding New Translation Models

1. Add model configuration to `backend/config.py` in `MODEL_REGISTRY`
2. Add language codes to `FAMILY_LANGUAGES` if needed
3. Add ISO mappings to `ISO_TO_NLLB` or `ISO_TO_M2M`
4. Restart the server

### Modifying the UI

- **Frontend**: Edit files in `frontend/` directory
- **Extension**: Edit files in `extension/` directory
- **Styles**: Both use similar CSS variables for theming

### Testing

```bash
# Run backend tests (if available)
python -m pytest

# Test API endpoints
curl http://localhost:8000/api/health
```

## 🌍 Supported Languages

FreeTranslate supports 200+ languages including:

- **Major Languages**: English, Spanish, French, German, Chinese, Japanese, Korean, Arabic, Russian, Portuguese
- **Regional Languages**: Hindi, Bengali, Urdu, Turkish, Vietnamese, Thai, Indonesian
- **European Languages**: Italian, Dutch, Polish, Swedish, Norwegian, Danish, Finnish, Greek
- **Middle Eastern**: Hebrew, Persian, Pashto, Kurdish
- **African Languages**: Swahili, Yoruba, Hausa, Zulu, Amharic
- **And many more...**

See `backend/config.py` for the complete list of supported languages.

## 🔍 Troubleshooting

### Server Won't Start
- Ensure Python 3.8+ is installed
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Verify port 8000 is not in use

### Model Download Fails
- Check your internet connection
- Set `HF_TOKEN` if using gated models
- Ensure sufficient disk space (5GB+)

### CUDA Not Available
- Verify NVIDIA GPU is installed
- Install CUDA Toolkit from NVIDIA
- Install PyTorch with CUDA support
- The application will automatically fall back to CPU if CUDA is unavailable

### Extension Not Working
- Ensure the backend server is running on `http://localhost:8000`
- Check browser console for errors
- Verify the extension has necessary permissions
- Try reloading the extension

### Translation Quality Issues
- The default model is nllb_1_3B which provides high-quality translations
- For even better quality on specific language pairs, consider fine-tuning
- Ensure correct language codes are selected
- For short texts, auto-detection may be less accurate

### Memory Issues
- Close other applications to free RAM
- The default model is nllb_1_3B - switch to nllb_600M for lower memory usage
- Process smaller text chunks
- Restart the server to clear memory

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- **Facebook/Meta** for the NLLB-200 translation models
- **Hugging Face** for the Transformers library and model hub
- **CTranslate2** for optimized inference engine
- **FastAPI** for the web framework
- The open-source community for various libraries and tools

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

## 🔮 Future Roadmap

- [ ] Support for more translation models (M2M100, Opus-MT)
- [ ] Translation history and bookmarks
- [ ] Keyboard shortcuts for faster translation
- [ ] Offline speech-to-text translation
- [ ] Mobile app (React Native)
- [ ] Collaborative translation features
- [ ] Translation quality metrics
- [ ] Custom terminology and glossaries
- [ ] Batch file translation
- [ ] API authentication for multi-user setups

---

**Made with ❤️ for privacy-focused translation**
