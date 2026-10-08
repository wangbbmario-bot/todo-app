"use client";

import { Network } from "lucide-react";

import { MindMapBoardWithProvider } from "@/components/canvas/mind-map-board";
import { useSelectedTask } from "@/lib/stores/todo-store";
import type { SubTask } from "@/lib/types";

/**
 * TaskBoard - 任务画板（思维导图）
 *
 * 包装 MindMapBoard，添加标题栏
 */

interface TaskBoardProps {
  subTasks: SubTask[];
}

export function TaskBoard({ subTasks }: TaskBoardProps) {
  const selectedTask = useSelectedTask();

  if (!selectedTask) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/10 text-sm text-muted-foreground">
        请先选择一个任务
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-muted/10">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">任务画板</h3>
        </div>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
          ✨ 思维导图
        </span>
      </div>
      <div className="flex-1">
        <MindMapBoardWithProvider task={selectedTask} subTasks={subTasks} />
      </div>
    </div>
  );
}