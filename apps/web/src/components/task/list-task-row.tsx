"use client";

import { Check, Trash2, Flag } from "lucide-react";

import { cn, formatTimeLabel } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DueDatePicker } from "@/components/due-date-picker";
import { TaskRow } from "./task-row";
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ORDER } from "@/lib/types";
import type { Task, TaskPriority } from "@/lib/types";

/**
 * ListTaskRow - 普通清单列表里的任务行
 *
 * 功能：
 * - 完成框（点击切换完成状态）
 * - 双击编辑（可选，本组件不实现 - 通过外部 onClick）
 * - 截止日期选择器（hover 显示）
 * - 右键菜单：改优先级 / 设截止日期 / 删除
 */

interface ListTaskRowProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  onRename?: (title: string) => void; // BUG-round3 z1-4：双击重命名
  onSetPriority: (priority: TaskPriority) => void;
  onSetDueAt: (dueAt: string | null) => void;
  // 2026-10-20：用户在任务名按 Enter → 在当前任务下创建新子任务
  onAddSubtask?: () => void;
  // 2026-10-20：新建同级任务后自动进入编辑态
  autoFocus?: boolean;
  onFocused?: () => void;
}

export function ListTaskRow({
  task,
  isSelected,
  onSelect,
  onToggleComplete,
  onDelete,
  onRename,
  onSetPriority,
  onSetDueAt,
  onAddSubtask,
  autoFocus,
  onFocused,
}: ListTaskRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
          <TaskRow
            task={task}
            isSelected={isSelected}
            onClick={onSelect}
            onRename={onRename}
            // 2026-10-20：Enter 后建新同级任务
            onAddSubtask={onAddSubtask}
            autoFocus={autoFocus}
            onFocused={onFocused}
            rightChildren={
              <>
                {/* BUG-2: 截止日期选择器（hover 显示）移到任务末尾 */}
                <DueDatePicker
                  value={task.dueAt}
                  onChange={onSetDueAt}
                  compact
                  className="opacity-0 group-hover:opacity-100"
                />

                {/* BUG-2: 删除按钮（hover）移到任务末尾 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                  data-testid="task-delete"
                  title="移到垃圾桶"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            }
          >
            {/* 完成框（保持最左） */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleComplete();
              }}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                task.status === "DONE"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary",
              )}
              data-testid="task-checkbox"
              title={task.status === "DONE" ? "已完成（点击取消）" : "点击完成任务"}
            >
              {task.status === "DONE" && <Check className="h-3 w-3" />}
            </button>
          </TaskRow>
        </div>
      </ContextMenuTrigger>

      {/* 右键菜单 */}
      <ContextMenuContent>
        <ContextMenuLabel className="text-xs">优先级</ContextMenuLabel>
        {PRIORITY_ORDER.map((p) => (
          <ContextMenuItem
            key={p}
            onSelect={() => onSetPriority(p)}
            className={cn(task.priority === p && "bg-muted")}
          >
            <Flag
              className="mr-2 h-3.5 w-3.5"
              style={{ color: PRIORITY_COLORS[p] }}
            />
            {PRIORITY_LABELS[p]}优先级
            {task.priority === p && <span className="ml-auto text-xs">✓</span>}
          </ContextMenuItem>
        ))}

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid="context-set-due">设置截止日期</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <QuickDueOptions onSetDueAt={onSetDueAt} />
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem
          onSelect={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// 提取的快捷截止日期选项
function QuickDueOptions({ onSetDueAt }: { onSetDueAt: (d: string | null) => void }) {
  return (
    <>
      <ContextMenuItem onSelect={() => onSetDueAt(endOfDay(0))}>今天</ContextMenuItem>
      <ContextMenuItem onSelect={() => onSetDueAt(endOfDay(1))} data-testid="context-set-due-tomorrow">明天</ContextMenuItem>
      <ContextMenuItem onSelect={() => onSetDueAt(endOfDay(7))}>一周后</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onSetDueAt(null)} className="text-destructive" data-testid="context-clear-due">
        清除截止日期
      </ContextMenuItem>
    </>
  );
}

function endOfDay(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}

// 仅导出 QuickDueOptions / endOfDay / formatTimeLabel 供其他场景复用
export { QuickDueOptions, endOfDay, formatTimeLabel };