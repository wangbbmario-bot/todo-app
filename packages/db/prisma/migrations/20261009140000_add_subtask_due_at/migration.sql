-- AddSubTaskDueAt: 子任务支持截止日期
ALTER TABLE "SubTask" ADD COLUMN "dueAt" TIMESTAMP(3);
-- 索引：方便按截止日期排序/筛选
CREATE INDEX "SubTask_dueAt_idx" ON "SubTask"("dueAt");
