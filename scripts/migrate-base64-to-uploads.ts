/**
 * migrate-base64-to-uploads.ts
 *
 * 把 DB 里 imageUrl 是 data:image/...;base64,... 格式的 FloatingNode
 * 全部迁移到 /data/uploads/{userId}/{nanoid}.{ext} 形式
 *
 * 一次性脚本，跑完即可（不影响运行）
 *
 * 用法：
 *   cd packages/db
 *   DATABASE_URL=postgresql://todo:xxx@localhost:5432/todo_prod npx tsx scripts/migrate-base64-to-uploads.ts
 */
import { prisma } from "../src";
import { promises as fs } from "node:fs";
import { customAlphabet } from "nanoid";
import path from "node:path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";

// 16 字符 url-safe id
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 16);

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

async function main() {
  console.log("🔍 查找 base64 编码的 FloatingNode...");

  const items = await prisma.floatingNode.findMany({
    where: { imageUrl: { startsWith: "data:" } },
    select: { id: true, userId: true, imageUrl: true },
  });

  console.log(`📦 找到 ${items.length} 条需要迁移`);

  for (const item of items) {
    const dataUrl = item.imageUrl!;
    // 解析 dataUrl: data:image/png;base64,iVBORw0KGgo...
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) {
      console.warn(`⚠️  ${item.id} 不是标准 dataUrl 格式，跳过`);
      continue;
    }
    const mime = m[1];
    const base64 = m[2];
    const ext = MIME_TO_EXT[mime] || "png";
    const buffer = Buffer.from(base64, "base64");

    // 写盘
    const userDir = path.join(UPLOAD_DIR, item.userId);
    const filename = `${nanoid()}.${ext}`;
    const filepath = path.join(userDir, filename);
    await fs.mkdir(userDir, { recursive: true });
    await fs.writeFile(filepath, buffer);

    // 新的 URL
    const newUrl = `/uploads/${item.userId}/${filename}`;

    // 改 DB
    await prisma.floatingNode.update({
      where: { id: item.id },
      data: { imageUrl: newUrl },
    });

    console.log(`✅  ${item.id}  → ${newUrl}  (${(buffer.length / 1024).toFixed(1)}KB)`);
  }

  console.log("🎉 迁移完成");
}

main()
  .catch((e) => {
    console.error("❌ 迁移失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });