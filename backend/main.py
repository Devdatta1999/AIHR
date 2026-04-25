from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from db import close_pool
from routers import analytics, auth, employee, hiring, interview_kit, onboarding


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    close_pool()


app = FastAPI(title="HR Platform API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(hiring.router, prefix="/hiring", tags=["hiring"])
app.include_router(interview_kit.router, prefix="/interview-kit", tags=["interview-kit"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
app.include_router(employee.router, prefix="/employee", tags=["employee"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])


@app.get("/health")
def health():
    return {"status": "ok"}
