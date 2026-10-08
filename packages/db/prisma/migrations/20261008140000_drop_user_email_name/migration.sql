-- DropUnusedFields: 移除 User.email 和 User.name 字段
-- 原因：这两个字段 UI 不输入，且 admin 页面未真正使用 email 列
-- 影响范围：
--   - auth/config.ts: 不再 select / 返回 name
--   - api/register/route.ts: 不再接受 / 写入 name
--   - api/admin/users/*: 不再 select / 返回 email + name
--   - api/admin/audit/route.ts: 不再 select email + name
--   - admin/users/page.tsx + [id]/page.tsx: 移除相关显示
--   - lib/admin-auth.ts: 移除 AdminSession 类型中的 email / name

-- DropIndex（如果有的话，先看 index 部分）
-- email 没有 unique 索引
-- name 没有索引
-- 直接 DROP COLUMN 即可

ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "User" DROP COLUMN IF EXISTS "name";
