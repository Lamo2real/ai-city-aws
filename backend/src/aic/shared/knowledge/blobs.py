"""The knowledge bucket behind one small interface: ``MemoryBlobs`` for tests, ``S3Blobs`` for AWS."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Protocol

PRESIGN_SECONDS = 3600


@dataclass(frozen=True)
class Head:
    size: int
    content_type: str | None


class Blobs(Protocol):
    bucket: str

    async def get(self, key: str) -> bytes: ...
    async def head(self, key: str) -> Head | None: ...
    async def put(self, key: str, body: bytes, content_type: str = "application/octet-stream") -> None: ...
    async def copy(self, src: str, dst: str) -> None: ...
    async def keys(self, prefix: str) -> list[str]: ...
    async def delete_prefix(self, prefix: str) -> int: ...
    async def presign_put(self, key: str, content_type: str) -> str: ...
    async def start_multipart(self, key: str, content_type: str) -> str: ...
    async def presign_part(self, key: str, upload_id: str, part_number: int) -> str: ...
    async def complete_multipart(self, key: str, upload_id: str, parts: list[dict[str, Any]]) -> None: ...
    async def abort_multipart(self, key: str, upload_id: str) -> None: ...


class MemoryBlobs:
    def __init__(self, bucket: str = "aic-test-knowledge") -> None:
        self.bucket = bucket
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.uploads: dict[str, dict[str, Any]] = {}

    async def get(self, key: str) -> bytes:
        if key not in self.objects:
            raise KeyError(key)
        return self.objects[key][0]

    async def head(self, key: str) -> Head | None:
        o = self.objects.get(key)
        return Head(len(o[0]), o[1]) if o else None

    async def put(self, key: str, body: bytes, content_type: str = "application/octet-stream") -> None:
        self.objects[key] = (body, content_type)

    async def copy(self, src: str, dst: str) -> None:
        self.objects[dst] = self.objects[src]

    async def keys(self, prefix: str) -> list[str]:
        return sorted(k for k in self.objects if k.startswith(prefix))

    async def delete_prefix(self, prefix: str) -> int:
        keys = await self.keys(prefix)
        for k in keys:
            del self.objects[k]
        return len(keys)

    async def presign_put(self, key: str, content_type: str) -> str:
        return f"https://{self.bucket}.s3.test/{key}?signed=put"

    async def start_multipart(self, key: str, content_type: str) -> str:
        uid = f"up-{len(self.uploads) + 1}"
        self.uploads[uid] = {"key": key, "content_type": content_type, "state": "open"}
        return uid

    async def presign_part(self, key: str, upload_id: str, part_number: int) -> str:
        return f"https://{self.bucket}.s3.test/{key}?uploadId={upload_id}&partNumber={part_number}"

    async def complete_multipart(self, key: str, upload_id: str, parts: list[dict[str, Any]]) -> None:
        up = self.uploads.get(upload_id)
        if not up or up["key"] != key or up["state"] != "open":
            raise KeyError(upload_id)
        up["state"] = "done"
        up["parts"] = parts
        self.objects[key] = (b"", up["content_type"])

    async def abort_multipart(self, key: str, upload_id: str) -> None:
        if upload_id in self.uploads:
            self.uploads[upload_id]["state"] = "aborted"


class S3Blobs:
    """``s3`` is a boto3 S3 client (signature v4, regional endpoint)."""

    def __init__(self, s3: Any, bucket: str) -> None:
        self._s3 = s3
        self.bucket = bucket

    async def get(self, key: str) -> bytes:
        r = await asyncio.to_thread(self._s3.get_object, Bucket=self.bucket, Key=key)
        body: bytes = await asyncio.to_thread(r["Body"].read)
        return body

    async def head(self, key: str) -> Head | None:
        try:
            r = await asyncio.to_thread(self._s3.head_object, Bucket=self.bucket, Key=key)
        except Exception as e:
            code = (getattr(e, "response", None) or {}).get("Error", {}).get("Code")
            if code in ("404", "NoSuchKey", "NotFound"):
                return None
            raise
        return Head(int(r.get("ContentLength", 0)), r.get("ContentType"))

    async def put(self, key: str, body: bytes, content_type: str = "application/octet-stream") -> None:
        await asyncio.to_thread(self._s3.put_object, Bucket=self.bucket, Key=key, Body=body, ContentType=content_type)

    async def copy(self, src: str, dst: str) -> None:
        # The managed copy switches to a multipart copy for large objects on its own.
        await asyncio.to_thread(self._s3.copy, {"Bucket": self.bucket, "Key": src}, self.bucket, dst)

    async def keys(self, prefix: str) -> list[str]:
        out: list[str] = []
        token: str | None = None
        while True:
            kw: dict[str, Any] = {"Bucket": self.bucket, "Prefix": prefix}
            if token:
                kw["ContinuationToken"] = token
            r = await asyncio.to_thread(self._s3.list_objects_v2, **kw)
            out.extend(o["Key"] for o in r.get("Contents", []))
            token = r.get("NextContinuationToken")
            if not token:
                return out

    async def delete_prefix(self, prefix: str) -> int:
        keys = await self.keys(prefix)
        for i in range(0, len(keys), 1000):
            chunk = keys[i : i + 1000]
            await asyncio.to_thread(
                self._s3.delete_objects,
                Bucket=self.bucket,
                Delete={"Objects": [{"Key": k} for k in chunk], "Quiet": True},
            )
        return len(keys)

    async def presign_put(self, key: str, content_type: str) -> str:
        url: str = await asyncio.to_thread(
            self._s3.generate_presigned_url,
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=PRESIGN_SECONDS,
        )
        return url

    async def start_multipart(self, key: str, content_type: str) -> str:
        r = await asyncio.to_thread(
            self._s3.create_multipart_upload, Bucket=self.bucket, Key=key, ContentType=content_type
        )
        return str(r["UploadId"])

    async def presign_part(self, key: str, upload_id: str, part_number: int) -> str:
        url: str = await asyncio.to_thread(
            self._s3.generate_presigned_url,
            "upload_part",
            Params={"Bucket": self.bucket, "Key": key, "UploadId": upload_id, "PartNumber": part_number},
            ExpiresIn=PRESIGN_SECONDS,
        )
        return url

    async def complete_multipart(self, key: str, upload_id: str, parts: list[dict[str, Any]]) -> None:
        await asyncio.to_thread(
            self._s3.complete_multipart_upload,
            Bucket=self.bucket,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={"Parts": [{"PartNumber": p["part_number"], "ETag": p["etag"]} for p in parts]},
        )

    async def abort_multipart(self, key: str, upload_id: str) -> None:
        await asyncio.to_thread(self._s3.abort_multipart_upload, Bucket=self.bucket, Key=key, UploadId=upload_id)
