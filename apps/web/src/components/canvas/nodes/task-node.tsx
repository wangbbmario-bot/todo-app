"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Flag } from "lucide-react";

import { cn } from "@/lib/utils";
import { LinkifiedText } from "@/components/ui/linkified-text";
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
        // 2026-10-29：加 max-w-[280px]
        //   长标题会把根节点撑到 600px+ → 子节点（固定 x=ROOT_X+280）被压在根节点底下，
        //   连线只能绕大圈，思维导图看起来"歪歪扭扭"
        "min-w-[180px] max-w-[280px] rounded-xl border-2 bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-3 shadow-sm transition-all",
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
      <div className="mt-1.5 min-w-0 truncate text-sm font-semibold text-foreground">
        {/* 2026-10-26：URL 渲染成可点击链接 */}
        <LinkifiedText text={d.title} />
      </div>
    </div>
  );
});
TaskNode.displayName = "TaskNode";