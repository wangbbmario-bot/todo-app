"use client";

import type { Node, Edge } from "@xyflow/react";

import { NODE_LAYOUT } from "@/lib/node-styles";
import type { SubTask, Task, FloatingNode } from "@/lib/types";
import type { TaskNodeData, SubTaskNodeData, FloatingNodeData } from "./nodes/types";

/**
 * useMindMapLayout - 思维导图布局算法
 *
 * 计算节点位置（根节点居中，子节点右侧垂直等距分布）
 * 和边（根 → 子任务）。游离节点不连接任何边，按其存储位置渲染。
 */

export function computeInitialLayout(
  task: Task,
  subTasks: SubTask[],
  floatingNodes: FloatingNode[] = [],
): { nodes: Node[]; edges: Edge[] } {
  const sortedSubs = [...subTasks].sort((a, b) => a.order - b.order);
  const totalNodes = sortedSubs.length;
  const spacing = NODE_LAYOUT.CHILD_Y_SPACING;
  const totalHeight = Math.max(1, totalNodes) * spacing;
  const startY = -totalHeight / 2 + NODE_LAYOUT.CHILD_Y_OFFSET_BASE;

  // BUG-round3 z2-20：父节点 y 始终等于子节点组 position 均值。
  // 子节点 i 的 position.y = startY + i * spacing，
  //   子节点组 position 均值 = startY + (N-1)/2 * spacing。
  // 代入 startY = -N*spacing/2，rootY = -spacing/2（与 N 无关，恒为子节点组中点）。
  // 这样不论 N=1/2/5/10，父节点位置恒定在子节点组中心 → 视觉居中。
  const rootY = totalNodes === 0
    ? NODE_LAYOUT.ROOT_Y
    : startY + ((totalNodes - 1) / 2) * spacing;

  const taskNode: Node<TaskNodeData> = {
    id: `task-${task.id}`,
    type: "task",
    position: { x: NODE_LAYOUT.ROOT_X, y: rootY },
    data: {
      title: task.title,
      priority: task.priority,
    },
    deletable: false,
  };

  const subNodes: Node<SubTaskNodeData>[] = sortedSubs.map((sub, i) => ({
    id: sub.id,
    type: "subtask",
    position: {
      x: NODE_LAYOUT.ROOT_X + 280,
      y: startY + i * NODE_LAYOUT.CHILD_Y_SPACING,
    },
    data: {
      title: sub.title,
      completed: sub.completed,
    },
  }));

  const edges: Edge[] = sortedSubs.map((sub) => ({
    id: `e-${sub.id}`,
    source: `task-${task.id}`,
    target: sub.id,
    type: "smoothstep",
    animated: false,
    style: {
      stroke: "var(--color-primary)",
      strokeWidth: 1.5,
      opacity: 0.6,
    },
  }));

  // 游离节点：BUG-15(z2-15) 按 task 隔离 — 只渲染属于当前 task 的游离节点
  // 兼容历史数据：taskId 为 null/undefined 也当作当前 task 的（早期未做隔离）
  const floatNodes: Node<FloatingNodeData>[] = floatingNodes
    // 2026-10-09：还要排除软删节点（deletedAt 非空）
    .filter((fn) => (fn.taskId == null || fn.taskId === task.id) && !fn.deletedAt)
    .map((fn) => ({
      id: fn.id,
      type: "floating",
      position: { x: fn.x, y: fn.y },
      data: {
        title: fn.title,
        kind: fn.kind,
        imageUrl: fn.imageUrl,
      },
    }));

  return {
    nodes: [taskNode, ...subNodes, ...floatNodes],
    edges,
  };
}