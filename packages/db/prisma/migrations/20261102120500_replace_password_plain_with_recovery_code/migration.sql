-- 2026-11-02：移除「明文密码 + 2 字符提示」找回方案，改用找回码
--
-- 背景：原方案把 passwordPlain 明文存库，且 forgot-password 接口只要
--   passwordPlain.includes(hint) 命中（hint 最少 2 个字符）就签发重置令牌。
--   知道手机号 + 猜中任意连续 2 个字符 = 账号被接管。
--   而且接口没有限速，可以反复尝试。
--
-- 新方案：
--   1. 删掉明文密码列（库里存着的明文一并清掉）
--   2. 新增 recoveryCodeHash（bcrypt 哈希的找回码）
--   3. 新增失败计数 / 锁定时间（DB 持久化，进程重启也挡得住）

-- 1) 删除明文密码列
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordPlain";

-- 2) 找回码（只存哈希）
ALTER TABLE "User" ADD COLUMN "recoveryCodeHash" TEXT;

-- 3) 找回尝试计数与锁定
ALTER TABLE "User" ADD COLUMN "recoveryFailCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "recoveryLockUntil" TIMESTAMP(3);
