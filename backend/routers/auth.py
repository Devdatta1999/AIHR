from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services import auth

router = APIRouter()


class LoginBody(BaseModel):
    role: str  # 'hr' | 'employee'
    email: str
    password: str


@router.post("/login")
def login(body: LoginBody):
    identity = auth.login(body.role, body.email, body.password)
    if not identity:
        raise HTTPException(401, "invalid credentials")
    token = auth.mint_token(identity)
    return {"token": token, "identity": identity}


@router.get("/me")
def me(identity=Depends(auth.current_identity)):
    return identity
