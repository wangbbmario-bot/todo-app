/**
 * /api/upload - 图片上传端点
 *
 * POST multipart/form-data:
 *   - file: 图片文件（png/jpeg/gif/webp, ≤ 5MB）
 *   - taskId: 可选，关联到某个 task（用于权限隔离）
 *
 * 流程：
 *   1. 鉴权（必须登录）
 *   2. 校验文件类型 / 大小
 *   3. 写到 /data/uploads/{userId}/{nanoid}.{ext}  (volume: uploads)
 *   4. 返回 { url: "/uploads/{userId}/{nanoid}.{ext}" }
 *
 * Caddy 端通过 file_server root /uploads 静态托管，前端直接 GET。
 *
 * 设计决策：
 *   - 不缩略图（原图 < 5MB，前端按需压缩）
 *   - 不鉴权访问上传文件（Caddy 静态托管，URL 不可猜 → nanoid 16 字符）
 *   - 不限文件 mime 后端强校验，扩展名按 mime 推导
 */
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { promises as fs } from "node:fs";
import path from "node:path";

import { auth } from "@/lib/auth/config";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = session.user.id;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file field" }, { status: 400 });
  }

  // 1. 大小校验
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `文件太大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限 5MB` },
      { status: 413 },
    );
  }

  // 2. mime 校验
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: `不支持的文件类型：${file.type || "unknown"}` },
      { status: 415 },
    );
  }

  // 3. 写盘
  //    路径: /data/uploads/{userId}/{nanoid(16)}.{ext}
  //    按 userId 分目录，避免单目录文件过多
  const userDir = path.join(UPLOAD_DIR, userId);
  const filename = `${nanoid(16)}.${ext}`;
  const filepath = path.join(userDir, filename);

  try {
    await fs.mkdir(userDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filepath, buffer);
  } catch (err) {
    console.error("[upload] write file failed:", err);
    return NextResponse.json({ error: "文件保存失败" }, { status: 500 });
  }

  // 4. 返回 URL
  //    前端拿这个 URL 存到 FloatingNode.imageUrl
  //    浏览器 GET /uploads/{userId}/{filename} 由 Caddy 直接 serve
  const url = `/uploads/${userId}/${filename}`;

  return NextResponse.json({
    ok: true,
    url,
    size: file.size,
    mime: file.type,
  });
}
