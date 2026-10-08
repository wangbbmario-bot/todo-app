"use client";

import { Trash2, RotateCcw, ArchiveRestore } from "lucide-react";

import { formatTimeLabel } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TaskRow } from "./task-row";
import type { Task } from "@/lib/types";

/**
 * TrashTaskRow - 垃圾桶里的任务行
 *
 * 特点：
 * - 显示删除时间
 * - hover 显示"恢复"和"永久删除"按钮
 * - 右键菜单：恢复 / 永久删除
 */

interface TrashTaskRowProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onPermanentlyDelete: () => void;
  onRename?: (title: string) => void; // BUG-round3 z1-4：双击重命名
}

export function TrashTaskRow({
  task,
  isSelected,
  onSelect,
  onRestore,
  onPermanentlyDelete,
  onRename,
}: TrashTaskRowProps) {
  const timeLabel = formatTimeLabel(task.completedAt ?? task.updatedAt);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TaskRow task={task} isSelected={isSelected} onClick={onSelect} editable={!!onRename} onRename={onRename}>
          {/* 占位图标 */}
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/40">
            <ArchiveRestore className="h-3 w-3" />
          </span>

          {/* 删除时间 */}
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {timeLabel}
          </span>

          {/* 恢复按钮（hover） */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            className="hidden shrink-0 rounded p-0.5 text-primary hover:bg-primary/10 group-hover:block"
            data-testid="task-restore"
            title="恢复任务"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* 永久删除按钮（hover） */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPermanentlyDelete();
            }}
            className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
            data-testid="task-permanent-delete"
            title="永久删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </TaskRow>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onSelect={onRestore}>
          <RotateCcw className="mr-2 h-4 w-4" />
          恢复任务
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={onPermanentlyDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          永久删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}