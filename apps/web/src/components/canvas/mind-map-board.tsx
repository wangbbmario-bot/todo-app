"use client";
/* eslint-disable react-hooks/set-state-in-effect -- 从外部 store 同步到本地 state 是合理场景 */

import { toast } from "sonner";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  BackgroundVariant,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTodoStore } from "@/lib/stores/todo-store";
import { TaskNode } from "./nodes/task-node";
import { SubTaskNode } from "./nodes/subtask-node";
import { FloatingNode } from "./nodes/floating-node";
import type { SubTaskNodeData, FloatingNodeData } from "./nodes/types";
import { computeInitialLayout } from "./use-mind-map-layout";
import { EditNodeDialog } from "./edit-node-dialog";
import { MindMapToolbar, MindMapHint } from "./mind-map-toolbar";
import type { SubTask, Task } from "@/lib/types";

const nodeTypes = {
  task: TaskNode,
  subtask: SubTaskNode,
  floating: FloatingNode,
};

interface MindMapBoardProps {
  task: Task;
  subTasks: SubTask[];
}

/**
 * MindMapBoard - 思维导图画板主组件
 *
 * 子组件拆分：
 * - nodes/task-node.tsx - 任务根节点
 * - nodes/subtask-node.tsx - 子任务节点
 * - use-mind-map-layout.ts - 布局算法 hook
 * - mind-map-toolbar.tsx - 浮动工具栏
 * - edit-node-dialog.tsx - 改名对话框
 *
 * 状态同步策略：
 * - task 切换时完全重置 nodes/edges
 * - subTasks 数据变化时只更新 data 保留用户拖动的位置
 */
export function MindMapBoard({ task, subTasks }: MindMapBoardProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Store actions（先定义，所有 hook 都需要引用）
  const floatingNodes = useTodoStore((s) => s.floatingNodes);
  const addSubTask = useTodoStore((s) => s.addSubTask);
  const removeSubTask = useTodoStore((s) => s.removeSubTask);
  const toggleSubTask = useTodoStore((s) => s.toggleSubTask);
  const updateSubTaskTitle = useTodoStore((s) => s.updateSubTaskTitle);
  const addFloatingNode = useTodoStore((s) => s.addFloatingNode);
  const removeFloatingNode = useTodoStore((s) => s.removeFloatingNode);
  const updateFloatingNode = useTodoStore((s) => s.updateFloatingNode);

  // 初始化 + task 切换时重置
  const initial = useMemo(
    () => computeInitialLayout(task, subTasks, floatingNodes),
    [task, subTasks, floatingNodes],
  );
  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // subTasks / floatingNodes 变化时同步（保留用户拖动位置）
  // BUG-13(z2-13)：新建子任务后自动重新对齐所有子任务（父居中、子等距）
  // BUG-round3 z2-20：删除子任务后也要自动重排，父节点随子节点组几何中心居中
  useEffect(() => {
    setNodes((prev) => {
      const prevIds = new Set(prev.map((n) => n.id));
      const layout = computeInitialLayout(task, subTasks, floatingNodes);
      const layoutIds = new Set(layout.nodes.map((n) => n.id));
      // 对称差检测：prev 与 layout 任一节点 id 不重合（新增或删除）→ 强制重对齐
      const added = layout.nodes.some((n) => !prevIds.has(n.id));
      const removed = prev.some((n) => !layoutIds.has(n.id));
      if (added || removed) {
        // 增删 → 全部用 layout 位置（重新对齐，父居中）
        return layout.nodes;
      }
      // 否则保留用户拖动位置（仅属性变化如 priority/title 触发）
      const positionMap = new Map(prev.map((n) => [n.id, n.position]));
      return layout.nodes.map((n) => ({
        ...n,
        position: positionMap.get(n.id) ?? n.position,
      }));
    });
    setEdges(computeInitialLayout(task, subTasks, floatingNodes).edges);
  }, [task.title, task.priority, subTasks, floatingNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // 节点变化（拖动、选中、删除）— 通过 React Flow applyNodeChanges
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    // 同步 floating 节点拖动位置回 store
    changes.forEach((ch) => {
      if (ch.type === "position" && ch.position && ch.id?.startsWith("float-")) {
        useTodoStore.setState((state) => ({
          floatingNodes: state.floatingNodes.map((n) =>
            n.id === ch.id ? { ...n, x: ch.position!.x, y: ch.position!.y } : n,
          ),
        }));
      }
    });
  }, []);

  // 节点删除同步回 store（处理 floating 节点删除）
  const onNodesDelete = useCallback((deleted: Node[]) => {
    deleted.forEach((n) => {
      if (n.type === "floating") {
        removeFloatingNode(n.id);
      }
    });
  }, [removeFloatingNode]);

  // 编辑节点对话框状态
  // 2026-10-09：之前只支持改名子任务，floating 节点双击没反应
  // 改成 kind + id 形态，处理子任务和游离节点两种类型
  const [editingNode, setEditingNode] = useState<{
    id: string;
    title: string;
    kind: "subtask" | "floating";
  } | null>(null);
  const [previewingImage, setPreviewingImage] = useState<{ url: string; title: string } | null>(null);

  // BUG-10: 画板内 Ctrl+V 粘贴文字/图片生成游离节点
  const boardRef = useRef<HTMLDivElement>(null);
  const floatingNodesRef = useRef(floatingNodes);
  floatingNodesRef.current = floatingNodes;

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // 只在画板区域内响应（不是 input/textarea）
      if (!boardRef.current?.contains(target ?? document.body)) return;
      if (target?.closest("input, textarea, [contenteditable]")) return;

      e.preventDefault();
      const items = e.clipboardData?.items;
      if (!items) return;

      let handled = false;

      // 1) 图片：先 POST /api/upload 拿到 URL，再 addFloatingNode
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (!blob) continue;
          // 异步：fetch 上传 → 拿到 url → addFloatingNode
          (async () => {
            try {
              const fd = new FormData();
              fd.append("file", blob, blob.name || "image");
              const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error("[upload] failed:", err.error || res.status);
                return;
              }
              const { url } = (await res.json()) as { url: string };
              addFloatingNode({
                kind: "IMAGE",
                title: `图片 ${new Date().toLocaleTimeString("zh-CN")}`,
                imageUrl: url,
                taskId: task.id, // BUG-15：绑定任务
                x: 400,
                y: floatingNodesRef.current.length * 100 + 60,
              });
            } catch (err) {
              console.error("[upload] error:", err);
            }
          })();
          handled = true;
          break;
        }
      }

      // 2) 文字
      if (!handled) {
        const text = e.clipboardData?.getData("text/plain")?.trim();
        if (text) {
          addFloatingNode({
            kind: "TEXT",
            title: text.slice(0, 200),
            taskId: task.id, // BUG-15：绑定任务
            x: 400,
            y: floatingNodesRef.current.length * 80,
          });
        }
      }
    },
    [addFloatingNode, task.id],
  );

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    el.addEventListener("paste", handlePaste as unknown as EventListener);
    return () => el.removeEventListener("paste", handlePaste as unknown as EventListener);
  }, [handlePaste]);

  // BUG-8: 选中节点按 enter 创建同级子任务，按 tab 创建嵌套子节点（暂用游离节点代替）
  const handleBoardKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;

      const selectedSubtask = nodes.find(
        (n) => n.selected && n.type === "subtask",
      );
      if (!selectedSubtask) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // 创建同级子任务（同一 task 下）
        const newTitle = `新子任务 ${subTasks.length + 1}`;
        addSubTask(task.id, newTitle);
        // 选中新创建的子任务（等下一个 tick 后从 store 拿到 id）
        setTimeout(() => {
          const newSub = useTodoStore.getState().subTasks.find(
            (s) => s.taskId === task.id && s.title === newTitle,
          );
          if (newSub) {
            setNodes((prev) =>
              prev.map((n) =>
                n.id === newSub.id
                  ? { ...n, selected: true }
                  : n.type === "subtask"
                    ? { ...n, selected: false }
                    : n,
              ),
            );
          }
        }, 100);
      } else if (e.key === "Tab") {
        e.preventDefault();
        // 创建嵌套子节点（暂用游离节点代替，标题带前缀标识）
        addFloatingNode({
          kind: "TEXT",
          title: `子子任务（${(selectedSubtask.data as SubTaskNodeData).title}）`,
          taskId: task.id, // BUG-15：绑定任务
          x: 700,
          y: 200 + floatingNodesRef.current.length * 60,
        });
      }
    },
    [nodes, subTasks.length, addSubTask, task.id, addFloatingNode],
  );

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    el.addEventListener("keydown", handleBoardKeyDown);
    return () => el.removeEventListener("keydown", handleBoardKeyDown);
  }, [handleBoardKeyDown]);

  // 工具栏回调
  // BUG-9 + BUG-11(z2-11)：+ 号创建游离节点，初始位置在父任务方框上方
  const handleAddNode = useCallback(() => {
    addFloatingNode({
      kind: "TEXT",
      title: `新游离节点 ${floatingNodes.length + 1}`,
      taskId: task.id,  // BUG-15(z2-15)：绑定到当前任务，切换任务时不串
      x: 60,                                    // 父任务左侧一点
      y: -120 - (floatingNodes.length % 3) * 60, // 父任务上方，错开避免重叠
    });
  }, [addFloatingNode, floatingNodes.length, task.id]);

  const handleDeleteSelected = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    selected.forEach((n) => {
      if (n.type === "subtask") {
        removeSubTask(n.id);
      } else if (n.type === "floating") {
        removeFloatingNode(n.id);
      }
    });
  }, [nodes, removeSubTask, removeFloatingNode]);

  const handleAutoLayout = useCallback(() => {
    const layout = computeInitialLayout(task, subTasks);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [task, subTasks]);

  const handleFitView = useCallback(() => {
    // BUG-11(z2-11) + BUG-round3(z2-7) 修正：
    // 全屏元素上移到 BoardPanel（包含头部+子任务列表+画板），
    // 这里只 dispatch 事件，BoardPanel 监听并触发 requestFullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      // 退出全屏也 fitView（恢复非全屏视口）
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("todo-fit-view"));
      }, 100);
    } else {
      // dispatch 让 BoardPanel 处理 requestFullscreen（200ms fitView 由 BoardPanel 内部触发）
      window.dispatchEvent(new CustomEvent("todo-toggle-fullscreen"));
    }
  }, []);

  // 节点交互
  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      if (node.type === "subtask") {
        // BUG-1 (z1-3)：完成任务时弹吐司
        const sub = useTodoStore.getState().subTasks.find((s) => s.id === node.id);
        const wasCompleted = sub?.completed ?? false;
        toggleSubTask(node.id);
        if (!wasCompleted) {
          toast.success("任务已完成 🎉", { duration: 2000 });
        }
      } else if (node.type === "floating") {
        const fn = useTodoStore.getState().floatingNodes.find((f) => f.id === node.id);
        if (!fn) return;
        const data = node.data as FloatingNodeData;
        // 图片节点 → 单击查看大图（不是改名）
        if (data.kind === "IMAGE" && data.imageUrl) {
          setPreviewingImage({ url: data.imageUrl, title: fn.title });
        } else {
          // 文字节点 → 单击改名
          // 2026-10-09 修：之前没传 kind 字段，handleConfirmEdit 的 if/else 都不匹配
          setEditingNode({ id: fn.id, title: fn.title, kind: "floating" });
        }
      }
    },
    [toggleSubTask],
  );

  const handleNodeDoubleClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      // 子任务 → 改 subTask.title
      if (node.type === "subtask") {
        setEditingNode({
          id: node.id,
          title: (node.data as SubTaskNodeData).title,
          kind: "subtask",
        });
        return;
      }
      // 游离节点（文字/图片）→ 改 floatingNode.title
      if (node.type === "floating") {
        setEditingNode({
          id: node.id,
          title: (node.data as FloatingNodeData).title,
          kind: "floating",
        });
      }
    },
    [],
  );

  const handleConfirmEdit = useCallback(
    (newTitle: string) => {
      if (!editingNode) return;
      if (editingNode.kind === "subtask") {
        updateSubTaskTitle(editingNode.id, newTitle);
      } else if (editingNode.kind === "floating") {
        updateFloatingNode(editingNode.id, { title: newTitle });
      }
      setEditingNode(null);
    },
    [editingNode, updateSubTaskTitle, updateFloatingNode],
  );

  return (
    <div className="relative h-full w-full bg-background" ref={boardRef} tabIndex={0}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodesDelete={onNodesDelete}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={2}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{ type: "smoothstep" }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          color="var(--color-muted-foreground)"
        />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(0,0,0,0.05)"
          nodeColor={(n) =>
            n.type === "task" ? "var(--color-primary)" : "var(--color-muted-foreground)"
          }
          className="!bg-background/80 !border !border-border !rounded-md"
        />
        <Controls
          showInteractive={false}
          className="!bg-background !border !border-border !rounded-md !shadow-sm"
        />
        <MindMapToolbar
          onAddNode={handleAddNode}
          onFitView={handleFitView}
        />
        <MindMapHint />
      </ReactFlow>

      <EditNodeDialog
        open={editingNode !== null}
        initialTitle={editingNode?.title ?? ""}
        kind={editingNode?.kind ?? "subtask"}
        onConfirm={handleConfirmEdit}
        onCancel={() => setEditingNode(null)}
      />

      {/* 图片大图预览：单击 IMAGE 类型的游离节点触发 */}
      <Dialog
        open={previewingImage !== null}
        onOpenChange={(o) => !o && setPreviewingImage(null)}
      >
        <DialogContent className="max-w-[90vw] max-h-[90vh] !p-2 border-none bg-transparent shadow-none">
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          {previewingImage && (
            <img
              src={previewingImage.url}
              alt={previewingImage.title}
              className="max-h-[85vh] max-w-full rounded shadow-2xl"
              data-testid="floating-image-preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ 带 Provider 的导出 ============
export function MindMapBoardWithProvider(props: MindMapBoardProps) {
  return (
    <ReactFlowProvider>
      <MindMapBoard {...props} />
    </ReactFlowProvider>
  );
}