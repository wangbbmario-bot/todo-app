"use client";

import { useState, KeyboardEvent, useCallback } from "react";
import { Plus, Flag, Trash } from "lucide-react";
import { toast } from "sonner";

import {
  useTodoStore,
  useSelectedList,
  useTasksForList,
} from "@/lib/stores/todo-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListTaskRow } from "@/components/task/list-task-row";
import { DoneTaskRow } from "@/components/task/done-task-row";
import { TrashTaskRow } from "@/components/task/trash-task-row";
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ORDER } from "@/lib/types";
import type { Task, TaskPriority } from "@/lib/types";

/**
 * TaskPanel - 任务列表面板
 *
 * 顶部固定（清单名 + 系统区段操作按钮 + 添加任务输入框）
 * 主区域根据 listKind 渲染不同的任务行组件：
 * - LIST: ListTaskRow（按优先级分组）
 * - DONE: DoneTaskRow（按完成时间倒序）
 * - TRASH: TrashTaskRow（按删除时间倒序）
 */

export function TaskPanel() {
  const selectedList = useSelectedList();
  const tasks = useTasksForList(selectedList?.id ?? null);
  const selectedTaskId = useTodoStore((s) => s.selectedTaskId);
  const selectTask = useTodoStore((s) => s.selectTask);
  const createTask = useTodoStore((s) => s.createTask);
  const updateTask = useTodoStore((s) => s.updateTask); // BUG-round3 z1-4：双击重命名
  const toggleTaskComplete = useTodoStore((s) => s.toggleTaskComplete);
  const deleteTask = useTodoStore((s) => s.deleteTask);
  const setTaskPriority = useTodoStore((s) => s.setTaskPriority);
  const setTaskDueAt = useTodoStore((s) => s.setTaskDueAt);
  const restoreTask = useTodoStore((s) => s.restoreTask);
  const permanentlyDeleteTask = useTodoStore((s) => s.permanentlyDeleteTask);
  const clearCompleted = useTodoStore((s) => s.clearCompleted);
  const clearTrash = useTodoStore((s) => s.clearTrash);

  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleAddTask = () => {
    if (!selectedList || selectedList.kind !== "LIST") return;
    const title = newTaskTitle.trim();
    if (!title) return;
    createTask(selectedList.id, title, "LOW");
    setNewTaskTitle("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddTask();
    }
  };

  const listKind = selectedList?.kind ?? "LIST";
  const isReadOnly = listKind !== "LIST";
  const isDone = listKind === "DONE";
  const isTrash = listKind === "TRASH";

  // 统一封装：toggle 任务完成 + 弹吐司（任务列表行 / DoneTaskRow 都用这个）
  // z2-4 修复：之前组件化时只有画板节点的 toggle 会弹吐司，任务行不会弹，补齐
  const handleToggleComplete = useCallback(
    (id: string) => {
      const task = useTodoStore.getState().tasks.find((t) => t.id === id);
      const wasDone = task?.status === "DONE";
      toggleTaskComplete(id);
      if (!wasDone && task) {
        toast.success("任务已完成 🎉", { duration: 2000 });
      }
    },
    [toggleTaskComplete],
  );

  // 已完成 / 垃圾桶：按时间倒序
  const timeSortedTasks = [...tasks].sort((a, b) => {
    const aTime = a.completedAt ?? a.updatedAt;
    const bTime = b.completedAt ?? b.updatedAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  // LIST：按优先级分组
  const tasksByPriority = PRIORITY_ORDER.reduce<Record<TaskPriority, Task[]>>(
    (acc, p) => {
      acc[p] = tasks.filter((t) => t.priority === p);
      return acc;
    },
    { HIGH: [], MEDIUM: [], LOW: [] } as Record<TaskPriority, Task[]>,
  );

  return (
    <div className="flex h-full flex-col bg-background" data-testid="task-panel">
      {/* 头部 */}
      <div className="border-b px-4 py-3" data-testid="task-panel-header">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {selectedList && (
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: selectedList.color }}
              />
            )}
            <h2 className="truncate text-base font-semibold text-foreground">
              {selectedList?.name ?? "未选择清单"}
            </h2>
            {tasks.length > 0 && (
              <span
                className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums"
                data-testid="task-count"
              >
                {tasks.length}
              </span>
            )}
          </div>

          {/* 系统区段操作按钮 */}
          {isDone && tasks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                if (confirm(`确定清空所有已完成任务（${tasks.length} 条）？`)) {
                  clearCompleted();
                }
              }}
            >
              <Trash className="mr-1 h-3 w-3" />
              清空
            </Button>
          )}
          {isTrash && tasks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive"
              onClick={() => {
                if (confirm(`永久删除所有垃圾桶任务（${tasks.length} 条）？此操作不可恢复！`)) {
                  clearTrash();
                }
              }}
            >
              <Trash className="mr-1 h-3 w-3" />
              清空
            </Button>
          )}
        </div>
      </div>

      {/* 添加任务输入框（仅 LIST） */}
      {!isReadOnly && selectedList && (
        <div className="border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="+ 添加新任务，按回车键可创建"
              className="h-8 text-sm"
              data-testid="task-input"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleAddTask}
              disabled={!newTaskTitle.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 任务列表区 */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-2">
          {tasks.length === 0 && (
            <div className="px-2 py-8 text-center text-sm text-muted-foreground">
              {selectedList
                ? isTrash
                  ? "垃圾桶是空的"
                  : isDone
                    ? "还没有完成的任务"
                    : "暂无任务"
                : "从左侧选择一个清单"}
            </div>
          )}

          {/* LIST：按优先级分组 */}
          {listKind === "LIST" &&
            PRIORITY_ORDER.map((priority) => {
              const list = tasksByPriority[priority];
              if (list.length === 0) return null;
              return (
                <div key={priority} className="mb-3">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                    <Flag className="h-3 w-3" style={{ color: PRIORITY_COLORS[priority] }} />
                    {PRIORITY_LABELS[priority]}优先级
                    <span className="ml-auto tabular-nums">{list.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {list.map((task) => (
                      <ListTaskRow
                        key={task.id}
                        task={task}
                        isSelected={task.id === selectedTaskId}
                        onSelect={() => selectTask(task.id)}
                        onToggleComplete={() => handleToggleComplete(task.id)}
                        onDelete={() => deleteTask(task.id)}
                        onRename={(title) => updateTask(task.id, { title })}
                        onSetPriority={(p) => setTaskPriority(task.id, p)}
                        onSetDueAt={(d) => setTaskDueAt(task.id, d)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

          {/* DONE：按完成时间倒序 */}
          {isDone && (
            <div className="space-y-0.5">
              {timeSortedTasks.map((task) => (
                <DoneTaskRow
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onSelect={() => selectTask(task.id)}
                  onUncomplete={() => handleToggleComplete(task.id)}
                  onRename={(title) => updateTask(task.id, { title })}
                />
              ))}
            </div>
          )}

          {/* TRASH：按删除时间倒序 */}
          {isTrash && (
            <div className="space-y-0.5">
              {timeSortedTasks.map((task) => (
                <TrashTaskRow
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onSelect={() => selectTask(task.id)}
                  onRestore={() => restoreTask(task.id)}
                  onPermanentlyDelete={() => {
                    if (confirm("永久删除此任务？此操作不可恢复！")) {
                      permanentlyDeleteTask(task.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// 重新导出 cn 供上层使用（如有）
export { cn };