"use client";

import { useEffect, useRef, useState } from "react";

import { cn, formatDateLabel } from "@/lib/utils";
import { PRIORITY_COLORS } from "@/lib/types";
import type { Task } from "@/lib/types";

/**
 * TaskRow - 任务行组件
 *
 * 功能：
 * - 显示任务优先级色条 + 任务名 + 截止日期徽章
 * - 左侧/右侧插槽由 wrapper 注入（完成框 / 操作按钮）
 * - BUG-round3 z1-4：hover + 双击进入编辑模式重命名
 *
 * 设计：
 * - editing state 在 TaskRow 内部管理，wrapper 通过 onRename 接收保存事件
 * - 默认 editable=true；Trash 等不需要重命名的场景可传 false
 */

interface TaskRowProps {
  task: Task;
  isSelected?: boolean;
  onClick?: () => void;
  editable?: boolean; // 是否支持双击重命名（默认 true）
  onRename?: (newTitle: string) => void; // 编辑完成回调
  children?: React.ReactNode; // 左侧插槽
  rightChildren?: React.ReactNode; // 右侧插槽
  // 2026-10-20：用户在任务名按 Enter → 在画板新建一个子任务
  onAddSubtask?: () => void;
}

export function TaskRow({
  task,
  isSelected,
  onClick,
  editable = true,
  onRename,
  children,
  rightChildren,
  onAddSubtask,
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // 进入编辑态时聚焦 + 光标定位文字末尾（不 select-all）
  // 2026-10-20 改：之前 .select() 全选文本让用户改起来很烦
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const startEdit = () => {
    if (!editable) return;
    setDraft(task.title);
    setIsEditing(true);
  };

  // 单击任务名 = 选中任务 + 进入编辑（不阻止冒泡，让 row.onClick=selectTask 也触发）
  const handleTitleClick = () => {
    if (!editable) return;
    startEdit();
  };

  const commit = (opts?: { keepEditing?: boolean }) => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) {
      onRename?.(trimmed);
    }
    if (!opts?.keepEditing) {
      setIsEditing(false);
    }
  };

  const cancel = () => {
    setDraft(task.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // 2026-10-20 改：Enter = 提交 + 触发父级建新子任务（不退出编辑态，让新子任务接管）
      commit({ keepEditing: true });
      onAddSubtask?.();
      setIsEditing(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
    // 阻止冒泡，避免触发其他快捷键
    e.stopPropagation();
  };

  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
        isSelected ? "bg-primary/10" : "hover:bg-muted",
        (task.status === "DONE" || task.status === "CANCELLED") && "opacity-60",
      )}
      data-testid="task-row"
      onClick={onClick}
    >
      {/* 左侧插槽（完成框 / 图标，由 wrapper 注入） */}
      {children}

      {/* 优先级色条 */}
      <span
        className="h-3 w-0.5 shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        title={`优先级: ${task.priority}`}
      />

      {/* 任务名（z1-4 调整：单击直接进入编辑模式，不再双击） */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 rounded border border-primary/40 bg-background px-1 outline-none focus:border-primary"
          data-testid="task-title-input"
          aria-label="任务名"
        />
      ) : (
        <span
          className={cn(
            "flex-1 cursor-text truncate rounded px-1 hover:bg-background",
            (task.status === "DONE" || task.status === "CANCELLED") && "line-through",
          )}
          title={editable ? "单击修改名称" : undefined}
          onClick={handleTitleClick}
        >
          {task.title}
        </span>
      )}

      {/* 截止日期徽章（任何状态都显示） */}
      {task.dueAt && <DueDateBadgeInline dueAt={task.dueAt} data-testid="due-badge" />}

      {/* 右侧插槽（任务末尾的操作元素） */}
      {rightChildren}
    </div>
  );
}

export function DueDateBadgeInline({
  dueAt,
  ...rest
}: { dueAt: string } & React.HTMLAttributes<HTMLSpanElement>) {
  const { isOverdue, label, fullDate } = formatDateLabel(dueAt);
  return (
    <span
      {...rest}
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        rest.className,
        isOverdue
          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
          : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
      )}
      title={fullDate}
    >
      {label}
    </span>
  );
}
