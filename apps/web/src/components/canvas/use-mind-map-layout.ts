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
      // 2026-10-29：根节点 max-w 280px，这里再加 CHILD_X_GAP 的间距，
      //   让子节点左边缘 = 根节点右边缘 + 120，不再压在根节点底下
      //   （之前固定 +280，正好等于根节点理论宽度；根节点被长标题撑宽就重叠了）
      x: NODE_LAYOUT.ROOT_X + 280 + NODE_LAYOUT.CHILD_X_GAP,
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
    // 2026-10-29：改回 smoothstep（直角折线）—— 用户明确要折线不要曲线
    //   之前"歪歪扭扭"的根因不是折线本身，而是父子节点重叠导致连线绕路，
    //   那个问题已通过 max-w + 拉开间距修好，所以折线不会绕路了
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
      // 第五轮 BUG4b：width/height 必须放在 node 顶层，不能只放 data
      // RF 的 NodeResizer 在拖动过程中通过 setAttributes 直接改 node.width/height
      // 并同步到 wrapper 的 style，视觉上就是"实时生效"。
      // 如果只在 data 里给尺寸，组件再用 style={{width: d.width}} 渲染，
      // 每次 React 重渲染都会把 RF 刚写好的实时尺寸覆盖回旧值 → 表现为"松手才生效"。
      //
      // 2026-11-02：width 必须给兜底值（fn.width ?? 220）。
      //   便利贴内层改成 w-full（填满 wrapper）后，wrapper 必须有确定宽度，
      //   否则 wrapper 是 auto（shrink-to-fit），便签宽度会跟着文字内容走 —— 反而更糟。
      //   220 = 之前组件内层的默认值，保持视觉一致。
      width: fn.width ?? 220,
      height: fn.height,
      data: {
        title: fn.title,
        kind: fn.kind,
        imageUrl: fn.imageUrl,
        // data 里也留一份，给组件内部的 minWidth/maxWidth 兜底
        width: fn.width,
        height: fn.height,
      },
    }));

  return {
    nodes: [taskNode, ...subNodes, ...floatNodes],
    edges,
  };
}