-- AddFloatingNodeTaskId: 让游离节点按 task 隔离显示
-- 之前 schema 没有 taskId 字段 → 所有游离节点在所有任务画板都显示
-- 加完字段后，旧数据 taskId=NULL → 行为兼容（仍然所有任务可见）
-- 新上传的图 taskId=具体 task → 只在该任务可见

ALTER TABLE "FloatingNode" ADD COLUMN "taskId" TEXT;

-- 索引：经常按 userId + taskId 过滤游离节点
CREATE INDEX "FloatingNode_taskId_idx" ON "FloatingNode"("taskId");
