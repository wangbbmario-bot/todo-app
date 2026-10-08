-- RestorePasswordPlain: 恢复 User.passwordPlain 字段
-- 找回密码用：明文存库，验证时比对 passwordPlain.includes(hint)
-- 用户明确选择此方案（不接受 SMS 验证码）

ALTER TABLE "User" ADD COLUMN "passwordPlain" TEXT;
