"""Authenticated production API. No demo corpus is used by these operations."""

from pathlib import PurePath
from uuid import UUID, uuid4
import hashlib

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from app.services.supabase import Identity, Supabase, identity, admin, error
from app.services.processing import KINDS

router = APIRouter(prefix="/api/v1", tags=["مساحة الشركة"])
DOC_FIELDS = "id,company_id,department_id,title,description,status,visibility,version,mime_type,size_bytes,storage_bucket,storage_path,original_name,uploaded_at,processing_error,created_at"


class Named(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)


class Invite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    display_name: str = Field(min_length=1, max_length=200)
    department_id: UUID | None = None
    role: str = Field(default="new_employee", pattern="^(new_employee|company_admin)$")


def trusted(request: Request) -> Supabase:
    return Supabase(request.app.state.settings, trusted=True)


@router.get("/me")
def me(member: Identity = Depends(identity)):
    companies = member.db.rows(
        "companies", select="id,name", id="eq." + member.company_id, limit="1"
    )
    return {"profile": member.profile, "company": companies[0] if companies else None}


class ProfileName(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    display_name: str = Field(min_length=1, max_length=200)


@router.patch("/profile")
def update_profile(body: ProfileName, member: Identity = Depends(identity)):
    return member.db.request(
        "PATCH",
        "/rest/v1/profiles",
        params={"id": "eq." + member.user_id, "company_id": "eq." + member.company_id},
        data=body.model_dump(),
    )


@router.patch("/company")
def update_company(body: Named, member: Identity = Depends(admin)):
    return member.db.request(
        "PATCH",
        "/rest/v1/companies",
        params={"id": "eq." + member.company_id},
        data={"name": body.name},
    )


@router.get("/departments")
def departments(member: Identity = Depends(identity)):
    return member.db.rows(
        "departments",
        select="id,name,description",
        company_id="eq." + member.company_id,
        order="name",
        limit="500",
    )


@router.post("/departments", status_code=201)
def create_department(body: Named, member: Identity = Depends(admin)):
    return member.db.request(
        "POST", "/rest/v1/departments", data={"company_id": member.company_id, **body.model_dump()}
    )


@router.patch("/departments/{department_id}")
def edit_department(department_id: UUID, body: Named, member: Identity = Depends(admin)):
    rows = member.db.request(
        "PATCH",
        "/rest/v1/departments",
        params={"id": "eq." + str(department_id), "company_id": "eq." + member.company_id},
        data=body.model_dump(),
    )
    if not rows:
        error(404, "NOT_FOUND", "القسم غير موجود.")
    return rows


@router.delete("/departments/{department_id}")
def delete_department(department_id: UUID, member: Identity = Depends(admin)):
    rows = member.db.request(
        "DELETE",
        "/rest/v1/departments",
        params={"id": "eq." + str(department_id), "company_id": "eq." + member.company_id},
    )
    if not rows:
        error(404, "NOT_FOUND", "القسم غير موجود.")
    return {"deleted": True}


@router.get("/members")
def members(member: Identity = Depends(admin)):
    return member.db.rows(
        "profiles",
        select="id,display_name,department_id,role,is_active",
        company_id="eq." + member.company_id,
        order="created_at",
        limit="500",
    )


@router.post("/members/invite", status_code=201)
def invite(body: Invite, request: Request, member: Identity = Depends(admin)):
    if body.department_id and not member.db.rows(
        "departments",
        select="id",
        id="eq." + str(body.department_id),
        company_id="eq." + member.company_id,
    ):
        error(422, "INVALID_DEPARTMENT", "القسم غير صالح.")
    service = trusted(request)
    user = service.request(
        "POST",
        "/auth/v1/invite",
        params={"redirect_to": request.app.state.settings.auth_redirect_url},
        data={"email": body.email, "data": {"display_name": body.display_name}},
    )
    user_id = str(UUID(user.get("id") or user["user"]["id"]))
    service.rpc(
        "provision_member",
        {
            "actor": member.user_id,
            "member_id": user_id,
            "member_name": body.display_name,
            "member_department": str(body.department_id) if body.department_id else None,
            "member_role": body.role,
        },
    )
    return {"invited": True}


@router.get("/documents")
def documents(member: Identity = Depends(identity)):
    return member.db.rows(
        "documents",
        select=DOC_FIELDS,
        company_id="eq." + member.company_id,
        order="created_at.desc",
        limit="500",
    )


def allowed_document(document_id: UUID, member: Identity):
    rows = member.db.rows(
        "documents",
        select=DOC_FIELDS,
        id="eq." + str(document_id),
        company_id="eq." + member.company_id,
        limit="1",
    )
    if not rows:
        error(404, "NOT_FOUND", "المستند غير متاح لك.")
    return rows[0]


@router.get("/documents/{document_id}")
def document_metadata(document_id: UUID, member: Identity = Depends(identity)):
    return allowed_document(document_id, member)


@router.get("/documents/{document_id}/chunks")
def document_chunks(document_id: UUID, member: Identity = Depends(identity)):
    allowed_document(document_id, member)
    return member.db.rows(
        "document_chunks",
        select="id,content,page_number,section_title,chunk_index",
        document_id="eq." + str(document_id),
        company_id="eq." + member.company_id,
        order="chunk_index",
        limit="80",
    )


@router.get("/documents/{document_id}/download")
def document_download(document_id: UUID, member: Identity = Depends(identity)):
    row = allowed_document(document_id, member)
    path = member.db.storage_path(row["storage_bucket"], row["storage_path"]).replace(
        "/storage/v1/object/", "/storage/v1/object/sign/", 1
    )
    result = member.db.request("POST", path, data={"expiresIn": 60})
    relative = result.get("signedURL") or result.get("signedUrl") or ""
    if not relative.startswith("/object/sign/"):
        error(502, "INVALID_DOWNLOAD", "تعذّر إنشاء رابط تنزيل آمن.")
    return {
        "url": member.db.settings.supabase_url.rstrip("/") + "/storage/v1" + relative,
        "expires_in": 60,
    }


@router.post("/documents", status_code=201)
def upload(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    visibility: str = Form("admins"),
    department_id: UUID | None = Form(None),
    member: Identity = Depends(admin),
):
    data = file.file.read(request.app.state.settings.max_upload_bytes + 1)
    file.file.close()
    if not data or len(data) > request.app.state.settings.max_upload_bytes:
        error(413, "FILE_SIZE", "حجم الملف يجب أن يكون بين 1 بايت و5 ميغابايت.")
    title = title.strip()
    if (
        not 1 <= len(title) <= 300
        or visibility not in {"company", "department", "admins"}
        or (visibility == "department" and not department_id)
    ):
        error(422, "INVALID_DOCUMENT", "تحقق من العنوان ونطاق المستند.")
    suffix = PurePath(file.filename or "").suffix.lower()
    expected = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain",
    }
    mime = expected.get(suffix)
    if mime not in KINDS or file.content_type not in {mime, "application/octet-stream"}:
        error(415, "FILE_TYPE", "ندعم PDF وDOCX وTXT فقط.")
    if (suffix == ".pdf" and not data.startswith(b"%PDF-")) or (
        suffix == ".docx" and not data.startswith(b"PK\x03\x04")
    ):
        error(415, "FILE_SIGNATURE", "محتوى الملف لا يطابق نوعه.")
    if suffix == ".txt":
        try:
            if "\x00" in data.decode("utf-8-sig"):
                raise ValueError()
        except (ValueError, UnicodeError):
            error(415, "TEXT_ENCODING", "ملف TXT يجب أن يكون نصًا صالحًا بترميز UTF-8.")
    doc_id = str(uuid4())
    path = member.company_id + "/" + doc_id + suffix
    service = trusted(request)
    service.rpc(
        "register_document",
        {
            "actor": member.user_id,
            "document_id": doc_id,
            "document_title": title,
            "department": str(department_id) if department_id else None,
            "document_visibility": visibility,
            "mime": mime,
            "byte_size": len(data),
            "file_hash": hashlib.sha256(data).hexdigest(),
            "object_path": path,
            "file_name": PurePath(file.filename or "document").name[:255],
        },
    )
    try:
        service.request(
            "POST",
            service.storage_path("company-documents", path),
            content=data,
            headers={"Content-Type": mime, "x-upsert": "false"},
        )
        service.rpc(
            "mark_document_uploaded",
            {"actor": member.user_id, "document_id": doc_id, "successful": True},
        )
    except Exception:
        try:
            service.rpc(
                "mark_document_uploaded",
                {"actor": member.user_id, "document_id": doc_id, "successful": False},
            )
        except Exception:
            pass
        raise
    return {"id": doc_id, "status": "draft"}


@router.post("/documents/{document_id}/retry")
def retry_document(document_id: UUID, request: Request, member: Identity = Depends(admin)):
    return trusted(request).rpc(
        "manage_document",
        {"actor": member.user_id, "document_id": str(document_id), "operation": "retry"},
    )


@router.delete("/documents/{document_id}")
def remove_document(document_id: UUID, request: Request, member: Identity = Depends(admin)):
    service = trusted(request)
    row = service.rpc(
        "manage_document",
        {"actor": member.user_id, "document_id": str(document_id), "operation": "archive"},
    )
    if isinstance(row, list):
        row = row[0]
    service.request(
        "DELETE",
        "/storage/v1/object/" + row["storage_bucket"],
        data={"prefixes": [row["storage_path"]]},
    )
    service.rpc(
        "manage_document",
        {"actor": member.user_id, "document_id": str(document_id), "operation": "delete"},
    )
    return {"deleted": True}


@router.get("/conversations")
def conversations(member: Identity = Depends(identity)):
    return member.db.rows(
        "conversations",
        select="id,title,created_at,updated_at",
        owner_id="eq." + member.user_id,
        company_id="eq." + member.company_id,
        order="updated_at.desc",
        limit="100",
    )


class ConversationTitle(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=300)


def own_conversation(conversation_id: UUID, member: Identity):
    rows = member.db.rows(
        "conversations",
        select="id",
        id="eq." + str(conversation_id),
        owner_id="eq." + member.user_id,
        company_id="eq." + member.company_id,
        limit="1",
    )
    if not rows:
        error(404, "NOT_FOUND", "المحادثة غير متاحة.")


@router.get("/conversations/{conversation_id}/messages")
def messages(conversation_id: UUID, member: Identity = Depends(identity)):
    own_conversation(conversation_id, member)
    rows = member.db.rows(
        "messages",
        select="id,role,content,citations,response_status,model,created_at,turn_id",
        conversation_id="eq." + str(conversation_id),
        company_id="eq." + member.company_id,
        order="created_at.desc,role.desc,id.desc",
        limit="500",
    )

    return list(reversed(rows))


@router.patch("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: UUID, body: ConversationTitle, member: Identity = Depends(identity)
):
    own_conversation(conversation_id, member)
    return member.db.request(
        "PATCH",
        "/rest/v1/conversations",
        params={
            "id": "eq." + str(conversation_id),
            "owner_id": "eq." + member.user_id,
            "company_id": "eq." + member.company_id,
        },
        data={"title": body.title},
    )


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: UUID, member: Identity = Depends(identity)):
    own_conversation(conversation_id, member)
    member.db.request(
        "DELETE",
        "/rest/v1/conversations",
        params={
            "id": "eq." + str(conversation_id),
            "owner_id": "eq." + member.user_id,
            "company_id": "eq." + member.company_id,
        },
    )
    return {"deleted": True}


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: UUID | None = None
    role: str = Field(pattern="^(new_employee|company_admin)$")
    is_active: bool


@router.patch("/members/{member_id}")
def update_member(
    member_id: UUID, body: MemberUpdate, request: Request, member: Identity = Depends(admin)
):
    trusted(request).rpc(
        "update_member",
        {
            "actor": member.user_id,
            "member_id": str(member_id),
            "department": str(body.department_id) if body.department_id else None,
            "assigned_role": body.role,
            "active": body.is_active,
        },
    )
    return {"updated": True}


class DocumentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=300)
    department_id: UUID | None = None
    visibility: str = Field(pattern="^(company|department|admins)$")


@router.patch("/documents/{document_id}")
def edit_document(
    document_id: UUID, body: DocumentUpdate, request: Request, member: Identity = Depends(admin)
):
    if body.visibility == "department" and not body.department_id:
        error(422, "DEPARTMENT_REQUIRED", "اختر القسم لهذا النطاق.")
    trusted(request).rpc(
        "edit_document",
        {
            "actor": member.user_id,
            "document_id": str(document_id),
            "document_title": body.title,
            "department": str(body.department_id) if body.department_id else None,
            "scope": body.visibility,
        },
    )
    return {"updated": True}
