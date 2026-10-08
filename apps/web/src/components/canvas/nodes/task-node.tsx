"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Flag } from "lucide-react";

import { cn } from "@/lib/utils";
import { PRIORITY_COLORS_LABELS } from "@/lib/node-styles";
import { type TaskNodeData, PRIORITY_LABELS_MAP } from "./types";

/**
 * TaskNode - 思维导图根节点（任务）
 *
 * 视觉：圆角矩形 + 渐变背景 + 优先级色条
 */

export const TaskNode = memo(({ data, selected }: NodeProps) => {
  const d = data as TaskNodeData;
  return (
    <div
      className={cn(
        "min-w-[180px] rounded-xl border-2 bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-3 shadow-sm transition-all",
        selected ? "border-primary shadow-md" : "border-primary/40",
      )}
      data-testid="task-node"
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !bg-primary !border-2 !border-background"
      />
      <div className="flex items-center gap-1.5">
        <Flag
          className="h-3.5 w-3.5"
          style={{ color: PRIORITY_COLORS_LABELS[d.priority] }}
        />
        <span className="text-xs font-medium text-muted-foreground">
          {PRIORITY_LABELS_MAP[d.priority]}优先级
        </span>
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold text-foreground">
        {d.title}
      </div>
    </div>
  );
});
TaskNode.displayName = "TaskNode";