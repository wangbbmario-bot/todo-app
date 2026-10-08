"use client";

import { Check, CheckCircle2 } from "lucide-react";

import { cn, formatTimeLabel } from "@/lib/utils";
import { TaskRow } from "./task-row";
import type { Task } from "@/lib/types";

/**
 * DoneTaskRow - 已完成区段的任务行
 *
 * 特点：
 * - 显示完成时间（X 分钟前 / X 小时前 / X 天前 / M/D）
 * - 可点击切换回未完成（取消完成）
 * - 不可编辑截止日期、不可改优先级（已固定）
 */

interface DoneTaskRowProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
  onUncomplete: () => void;
  onRename?: (title: string) => void; // BUG-round3 z1-4：双击重命名
}

export function DoneTaskRow({ task, isSelected, onSelect, onUncomplete, onRename }: DoneTaskRowProps) {
  const timeLabel = formatTimeLabel(task.completedAt ?? task.updatedAt);

  return (
    <TaskRow task={task} isSelected={isSelected} onClick={onSelect} onRename={onRename}>
      {/* 完成状态图标（点击取消完成） */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUncomplete();
        }}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
          "border-primary bg-primary text-primary-foreground",
        )}
        data-testid="task-checkbox"
        title="已完成（点击取消完成）"
      >
        <Check className="h-3 w-3" />
      </button>

      {/* 完成时间 */}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {timeLabel}
      </span>

      {/* 装饰：右侧对勾（仅 hover 显示） */}
      <CheckCircle2 className="hidden h-3.5 w-3.5 shrink-0 text-primary group-hover:block" />
    </TaskRow>
  );
}