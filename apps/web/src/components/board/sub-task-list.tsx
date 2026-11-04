"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DueDatePicker } from "@/components/due-date-picker";
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
// 2026-10-09：复用父任务的 QuickDueOptions 选项（今天/明天/一周后/清除）
import { QuickDueOptions } from "@/components/task/list-task-row";
// 2026-10-10：截止日期徽章（与父任务 DueDateBadgeInline 一致）
import { DueDateBadgeInline } from "@/components/task/task-row";

/**
 * SubTaskList - 子任务列表（画板上方）
 *
 * 2026-10-09：截止日期逻辑与父任务（list-task-row）完全一致：
 * - 右键 → 弹出菜单 → 设置截止日期（今天/明天/一周后/清除）
 * - 截止日期徽章用 DueDatePicker 组件（与父任务同样的日历图标 + 相对时间）
 *
 * 2026-10-20：光标定末尾 + Enter 建新子任务
 * - 点击任务名 → focus + cursor 文字末尾（不 select-all）
 * - 按 Enter → 提交当前 + 在下面建新子任务，光标自动聚焦新子任务
 */

interface SubTaskListProps {
  subTasks: SubTask[];
  // 2026-10-20：onAdd 必须返回新建 id（用来聚焦新子任务）
  onAdd: (title: string) => string;
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
  // 2026-10-20：当前"待聚焦"子任务 id（onAddAfter 后聚焦）
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  const [input, setInput] = useState("");

  const handleAdd = () => {
    const title = input.trim();
    if (!title) return;
    // 2026-10-20：onAdd 返回新 id，自动聚焦
    const newId = onAdd(title);
    setInput("");
    setPendingFocusId(newId);
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
              // 2026-10-20：按 Enter 在下面建新子任务
              onAddAfter={() => {
                const newId = onAdd("");
                setPendingFocusId(newId);
              }}
              // 2026-10-20：标记是否需要自动进入编辑态
              autoFocus={pendingFocusId === sub.id}
              onFocused={() => setPendingFocusId(null)}
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
  autoFocus = false,
  onFocused,
  onAddAfter,
}: {
  sub: SubTask;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onSetDueAt: (dueAt: string | null) => void;
  // 2026-10-20：parent 标记新创建的子任务需要自动进入编辑模式
  autoFocus?: boolean;
  onFocused?: () => void;
  // 2026-10-20：按 Enter → 在下方建新子任务并聚焦
  onAddAfter?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sub.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (editing && input) {
      input.focus();
      // 2026-10-20 改：光标定位末尾而不是 select-all
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }, [editing]);

  // 2026-10-20：autoFocus prop 触发时自动进入编辑态，并通知 parent 清理标记
  useEffect(() => {
    if (autoFocus && !editing) {
      setDraft(sub.title);
      setEditing(true);
      onFocused?.();
    }
  }, [autoFocus]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // 2026-10-20：Enter → 提交当前 + 触发父级新建子任务
      handleCommit();
      onAddAfter?.();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(sub.title);
      setEditing(false);
    }
  };

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
            <>
              <span
                className={cn(
                  "flex-1 cursor-text truncate rounded px-1 hover:bg-background",
                  sub.completed && "line-through",
                )}
                data-testid="sub-task-title"
                onClick={handleStartEdit}
                title="单击修改名称"
              >
                {/* 2026-10-26：URL 渲染成可点击链接（编辑态仍是纯文本） */}
                {sub.title ? (
                  <LinkifiedText text={sub.title} />
                ) : (
                  <span className="text-muted-foreground">单击修改名称</span>
                )}
              </span>
              {/* 2026-10-10：截止日期徽章（一直显示，跟父任务 DueDateBadgeInline 一样） */}
              {sub.dueAt && <DueDateBadgeInline dueAt={sub.dueAt} data-testid="sub-task-due-badge" />}
            </>
          )}
          {/* 2026-10-09：截止日期选择器（hover 显示） */}
          <DueDatePicker
            value={sub.dueAt}
            onChange={onSetDueAt}
            compact
            className="opacity-0 group-hover:opacity-100"
            data-testid="sub-task-due-picker"
          />
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
      {/* 2026-10-09：右键菜单与父任务完全一致（QuickDueOptions 共享） */}
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
            设置截止日期
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <QuickDueOptions onSetDueAt={onSetDueAt} />
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