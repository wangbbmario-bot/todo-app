"use client";

import { Plus, Maximize2 } from "lucide-react";
import { Panel as FlowPanel } from "@xyflow/react";

import { Button } from "@/components/ui/button";

interface MindMapToolbarProps {
  onAddNode: () => void;
  onFitView: () => void;
}

/**
 * MindMapToolbar - 画板浮动工具栏（右上角）
 *
 * 操作：+ 添加游离节点 / ⛶ 全屏（适应视图）
 *
 * 移除 ✨ 自动布局按钮（自动布局已通过 subTasks/floatingNodes 变化的 useEffect 自动触发，
 * 用户无需手动点）。z2-13 已实现自动重新对齐，z2-19 删除冗余按钮。
 */
export function MindMapToolbar({
  onAddNode,
  onFitView,
}: MindMapToolbarProps) {
  return (
    <FlowPanel position="top-right" className="m-2 flex gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 bg-background/80 backdrop-blur"
        onClick={onAddNode}
        title="添加游离节点"
        data-testid="toolbar-add-node"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 bg-background/80 backdrop-blur"
        onClick={onFitView}
        title="全屏 / 适应视图"
        data-testid="toolbar-fit-view"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </FlowPanel>
  );
}

export function MindMapHint() {
  return (
    <FlowPanel position="bottom-left" className="m-2">
      <div className="rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
        {/* 2026-11-02：文案改成真实行为。
            原文「单击节点切换完成 · 双击改名」对便利贴是错的：
            便利贴单击 = 进编辑态（不是切换完成），而且删除入口完全没提到。 */}
        💡 任务单击切换完成 · 便利贴单击编辑 · 选中后按 Backspace 删除 · 拖动调整位置和大小
      </div>
    </FlowPanel>
  );
}