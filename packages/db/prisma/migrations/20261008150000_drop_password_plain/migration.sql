-- DropPasswordPlain: 移除 User.passwordPlain 字段
-- 原因：明文密码存 DB 是严重安全漏洞，10 秒可枚举所有弱密码
--
-- 找回密码改用 SMS 验证码（生产环境必做）
-- 现阶段（无 SMS 接入）：/api/auth/forgot-password 返回 503 错误
--
-- 同时清空现有 user 的 passwordPlain（如果有遗留）

ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordPlain";
