"use client";

import { useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import {
  useTodoStore,
  useSelectedTask,
  useSubTasksForTask,
} from "@/lib/stores/todo-store";
import { SubTaskList } from "@/components/board/sub-task-list";
import { TaskBoard } from "@/components/board/task-board";

/**
 * BoardPanel - 任务画板容器（右侧栏）
 *
 * 上：SubTaskList（子任务列表）
 * 下：TaskBoard（思维导图画板）
 *
 * 中间用横向分隔条，用户可拖动改变比例（1:4 默认）。
 *
 * BUG-round3 z2-7 修复：全屏范围从"只画板"上移到"整个 board-panel"，
 * 头部 + 子任务列表 + 画板一起进全屏，UI 跟非全屏一致。
 */

export function BoardPanel() {
  const selectedTask = useSelectedTask();
  const subTasks = useSubTasksForTask(selectedTask?.id ?? null);
  const addSubTask = useTodoStore((s) => s.addSubTask);
  const toggleSubTask = useTodoStore((s) => s.toggleSubTask);
  const updateSubTaskTitle = useTodoStore((s) => s.updateSubTaskTitle);
  const removeSubTask = useTodoStore((s) => s.removeSubTask);
  // 2026-10-09：子任务也支持截止日期
  const setSubTaskDueAt = useTodoStore((s) => s.setSubTaskDueAt);
  const layout = useTodoStore((s) => s.layout);
  const setLayout = useTodoStore((s) => s.setLayout);
  const containerRef = useRef<HTMLDivElement>(null);

  // BUG-round3 z2-7：监听 MindMapToolbar 工具栏发出的 "todo-toggle-fullscreen" 事件
  // 把整个 board-panel 进/出全屏，进出后都触发 fitView
  useEffect(() => {
    const handleToggle = () => {
      const el = containerRef.current;
      if (!el) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
        // 进入全屏等布局完成再 fitView（与 z2-7 已有逻辑一致）
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("todo-fit-view"));
        }, 200);
      }
    };
    window.addEventListener("todo-toggle-fullscreen", handleToggle);

    // 监听 ESC 退出全屏（用户按 ESC 而不是点工具栏按钮）
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // 已退出全屏，触发 fitView 恢复视口
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("todo-fit-view"));
        }, 100);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("todo-toggle-fullscreen", handleToggle);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const subTaskSize = Math.round(layout.subTaskRatio * 100);

  if (!selectedTask) {
    return (
      <div
        className="flex h-full items-center justify-center bg-muted/20 text-sm text-muted-foreground"
        data-testid="board-panel"
        data-board-state="empty"
      >
        从中间栏选择一个任务
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background" ref={containerRef} data-testid="board-panel">
      {/* 头部：任务名 */}
      <div className="border-b px-4 py-3">
        <h2 className="truncate text-base font-semibold text-foreground">
          {selectedTask.title}
        </h2>
        {selectedTask.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedTask.description}
          </p>
        )}
      </div>

      {/* 上下排列：子任务 + 画板 */}
      <PanelGroup direction="vertical" autoSaveId="todo-board-vertical">
        <Panel
          defaultSize={subTaskSize}
          minSize={10}
          maxSize={60}
          onResize={(size) => setLayout({ subTaskRatio: size / 100 })}
        >
          <SubTaskList
            subTasks={subTasks}
            onAdd={(title) => addSubTask(selectedTask.id, title)}
            onToggle={toggleSubTask}
            onRename={(id, title) => updateSubTaskTitle(id, title)}
            onDelete={(id) => removeSubTask(id)}
            // 2026-10-09：子任务截止日期
            onSetDueAt={(id, dueAt) => setSubTaskDueAt(id, dueAt)}
          />
        </Panel>

        <PanelResizeHandle className="h-1 bg-border transition-colors hover:bg-primary/50 data-[resize-handle-state=drag]:bg-primary" />

        <Panel defaultSize={100 - subTaskSize} minSize={30}>
          <TaskBoard subTasks={subTasks} />
        </Panel>
      </PanelGroup>
    </div>
  );
}