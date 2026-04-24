import os
from dotenv import load_dotenv

load_dotenv(override=True)

SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "")
HF_MODEL_ID = os.getenv("HF_MODEL_ID", "meta-llama/Llama-3.1-8B-Instruct")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN", "")
GOOGLE_ORGANIZER_EMAIL = os.getenv("GOOGLE_ORGANIZER_EMAIL", "")
COMPANY_NAME = os.getenv("COMPANY_NAME", "Nimbus Labs")
COMPANY_TAGLINE = os.getenv("COMPANY_TAGLINE", "AI that hires better")

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "company_knowledge")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

# Auth (demo-grade).
AUTH_SECRET = os.getenv("AUTH_SECRET", "change-me-nimbus-labs-demo-secret")
HR_EMAIL = os.getenv("HR_EMAIL", "hr@nimbuslabs.ai")
HR_PASSWORD = os.getenv("HR_PASSWORD", "hr-admin-2026")
DEFAULT_EMPLOYEE_PASSWORD = os.getenv("DEFAULT_EMPLOYEE_PASSWORD", "welcome123")
TOKEN_TTL_SECONDS = int(os.getenv("TOKEN_TTL_SECONDS", "86400"))
# Public URL of the employee portal — embedded in offer-letter emails.
# Defaults to :5174 because offer emails target candidates (Employee Portal),
# not HR. Override via PORTAL_URL in .env for production.
PORTAL_URL = os.getenv("PORTAL_URL", "http://localhost:5174")

# Onboarding documents live on local disk in dev.
ONBOARDING_DOCS_DIR = os.getenv(
    "ONBOARDING_DOCS_DIR",
    os.path.join(os.path.dirname(__file__), "data", "onboarding_docs"),
)
os.makedirs(ONBOARDING_DOCS_DIR, exist_ok=True)

if not SUPABASE_DB_URL:
    raise RuntimeError("SUPABASE_DB_URL is not set. Populate backend/.env.")
