"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Check, Plus, Trash2, Calendar, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useTodoStore } from "@/lib/stores/todo-store";
import type { SubTask } from "@/lib/types";

/**
 * SubTaskList - 子任务列表（画板上方）
 *
 * 显示当前任务的子任务，支持：
 * - 完成切换
 * - 添加新子任务（回车提交）
 * - 右键设置截止日期（2026-10-09 加）
 * - 滚动（多了有滚动条）
 */

interface SubTaskListProps {
  subTasks: SubTask[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  // 2026-10-09：子任务截止日期
  onSetDueAt: (id: string, dueAt: string | null) => void;
}

export function SubTaskList({
  subTasks,
  onAdd,
  onToggle,
  onRename,
  onDelete,
  onSetDueAt,
}: SubTaskListProps) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const title = input.trim();
    if (!title) return;
    onAdd(title);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const completed = subTasks.filter((s) => s.completed).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* 标题行：标题 + 计数 + 输入框（BUG-5: 输入框移到标题旁） */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <h3 className="shrink-0 text-xs font-semibold text-foreground">子任务</h3>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {completed}/{subTasks.length}
        </span>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="+ 子任务"
          className="h-7 text-xs"
          data-testid="sub-task-input"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
          title="添加子任务"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* BUG-6: 子任务列表加 max-height + 强制滚动条 */}
      <ScrollArea className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="space-y-0.5 p-2">
          {subTasks.map((sub) => (
            <SubTaskItem
              key={sub.id}
              sub={sub}
              onToggle={() => onToggle(sub.id)}
              onRename={(title) => onRename(sub.id, title)}
              onDelete={() => onDelete(sub.id)}
              onSetDueAt={(d) => onSetDueAt(sub.id, d)}
            />
          ))}
          {subTasks.length === 0 && (
            <p className="px-1.5 py-4 text-center text-xs text-muted-foreground">
              暂无子任务
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SubTaskItem({
  sub,
  onToggle,
  onRename,
  onDelete,
  onSetDueAt,
}: {
  sub: SubTask;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  // 2026-10-09
  onSetDueAt: (dueAt: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sub.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    // BUG-7: 单击名称进入编辑
    e.stopPropagation();
    setDraft(sub.title);
    setEditing(true);
  };

  const handleCommit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== sub.title) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const handleKeyDownEdit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(sub.title);
      setEditing(false);
    }
  };

  // 2026-10-09：截止日期快捷选项
  const endOfDay = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  };
  const dueDate = sub.dueAt ? new Date(sub.dueAt) : null;
  const isOverdue = dueDate && !sub.completed && dueDate.getTime() < Date.now();
  const isDueSoon = dueDate && !sub.completed && !isOverdue && dueDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group flex items-center gap-1.5 rounded px-1.5 py-1 text-xs",
            "hover:bg-muted",
            sub.completed && "opacity-50",
          )}
          data-testid="sub-task-item"
        >
          <button
            onClick={onToggle}
            className={cn(
              "flex h-3 w-3 shrink-0 items-center justify-center rounded border transition-colors",
              sub.completed
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 hover:border-primary",
            )}
            data-testid="sub-task-checkbox"
            title={sub.completed ? "已完成（点击取消）" : "完成子任务"}
          >
            {sub.completed && <Check className="h-2 w-2" />}
          </button>
          {editing ? (
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={handleKeyDownEdit}
              onClick={(e) => e.stopPropagation()}
              className="h-5 flex-1 px-1 text-xs"
            />
          ) : (
            <span
              className={cn(
                "flex-1 cursor-text truncate rounded px-1 hover:bg-background",
                sub.completed && "line-through",
              )}
              data-testid="sub-task-title"
              onClick={handleStartEdit}
              title="单击修改名称"
            >
              {sub.title || <span className="text-muted-foreground">单击修改名称</span>}
            </span>
          )}
          {/* 2026-10-09：截止日期徽章（红=过期、黄=快到期、灰=正常） */}
          {dueDate && (
            <span
              className={cn(
                "shrink-0 rounded px-1 text-[10px]",
                isOverdue && "bg-red-100 text-red-700",
                isDueSoon && "bg-yellow-100 text-yellow-700",
                !isOverdue && !isDueSoon && "text-muted-foreground",
              )}
              title={`截止 ${dueDate.toLocaleString("zh-CN")}`}
              data-testid="sub-task-due"
            >
              {`${dueDate.getMonth() + 1}/${dueDate.getDate()}`}
            </span>
          )}
          {/* BUG-9 (z1-3 第三轮)：垃圾桶按钮移到子任务列表行，hover 显示，点一下直接删除（不再二次确认） */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="ml-1 hidden shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
            title="删除子任务"
            data-testid="sub-task-delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </ContextMenuTrigger>
      {/* 2026-10-09：右键子任务设置截止日期 */}
      <ContextMenuContent className="text-xs">
        <ContextMenuItem onSelect={() => onToggle()}>
          {sub.completed ? "标记为未完成" : "标记为完成"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleStartEdit as any}>
          修改名称
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid="sub-task-set-due">
            <Calendar className="mr-1.5 h-3 w-3" />
            设置截止日期
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onSelect={() => onSetDueAt(endOfDay(0))}>
              今天
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => onSetDueAt(endOfDay(1))}
              data-testid="sub-task-set-due-tomorrow"
            >
              明天
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onSetDueAt(endOfDay(3))}>
              3 天后
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onSetDueAt(endOfDay(7))}>
              一周后
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => onSetDueAt(null)}
              className="text-destructive focus:text-destructive"
            >
              <X className="mr-1.5 h-3 w-3" />
              清除截止日期
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-1.5 h-3 w-3" />
          删除子任务
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}