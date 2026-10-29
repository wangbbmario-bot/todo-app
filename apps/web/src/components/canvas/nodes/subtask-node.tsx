"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { CheckCircle2, Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { type SubTaskNodeData } from "./types";

/**
 * SubTaskNode - 思维导图子节点（子任务）
 *
 * 视觉：圆角矩形 + 卡片 + 完成状态视觉反馈
 * 删除按钮已移至子任务列表行（sub-task-list.tsx）
 */
export const SubTaskNode = memo(({ data, selected }: NodeProps) => {
  const d = data as SubTaskNodeData;
  return (
    <div
      className={cn(
        // 2026-10-29：加 max-w-[320px]（长子任务名也会把节点撑宽，导致兄弟节点互相重叠）
        "group min-w-[160px] max-w-[320px] rounded-lg border bg-card px-3 py-2 shadow-sm transition-all",
        selected
          ? "border-primary shadow-md"
          : "border-border hover:border-primary/60",
        d.completed && "opacity-60",
      )}
      data-testid="subtask-node"
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !bg-muted-foreground !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !bg-muted-foreground !border-2 !border-background"
      />
      <div className="flex items-center gap-1.5">
        {d.completed ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        )}
        <span
          className={cn(
            // min-w-0：让 truncate 真正生效（父级有 max-w 后还需要它才能收缩）
            "min-w-0 flex-1 truncate text-xs",
            d.completed && "text-muted-foreground line-through",
          )}
        >
          {/* 2026-10-26：URL 渲染成可点击链接 */}
          <LinkifiedText text={d.title} />
        </span>
      </div>
    </div>
  );
});
SubTaskNode.displayName = "SubTaskNode";