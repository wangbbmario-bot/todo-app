"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import { Image as ImageIcon, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTodoStore } from "@/lib/stores/todo-store";
import { type FloatingNodeData } from "./types";

/**
 * FloatingNode - 画板游离节点（便利贴样式）
 *
 * 2026-10-20：按用户截图改为便利贴风格
 * - 单击进入编辑（不双击）
 * - 多行 bullet list（按 \n 拆，每行 • xxx）
 * - 左对齐
 * - 黄色便签配色
 * - 可调大小（NodeResizer 右下角）
 * - 自由拖动位置（React Flow 默认）
 * - 光标定位末尾（不 select-all）
 */
export const FloatingNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as FloatingNodeData;
  const isImage = d.kind === "IMAGE";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.title);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const commit = () => {
    if (draft !== d.title) {
      // 2026-10-20：直接调 store action 更新 title
      useTodoStore.getState().updateFloatingNode(id, { title: draft });
    }
    setEditing(false);
  };

  const lines = (d.title || "").split("\n");

  // 第五轮 BUG4c：选中游离节点后按 Backspace / Delete 删除
  // 必须挂在 window 上：焦点在画板容器（tabIndex=0）而不是节点本身，
  // 只挂在 div 的 onKeyDown 上收不到。编辑态时不响应，避免打字时误删。
  useEffect(() => {
    if (!selected || editing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      // 正在输入框里打字时不删（双保险）
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      e.stopPropagation();
      useTodoStore.getState().removeFloatingNode(id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, editing, id]);

  return (
    <div
      onClick={() => {
        if (!editing) setEditing(true);
      }}
      onBlur={() => {
        if (editing) commit();
      }}
      className={cn(
        // 2026-10-20：这里绝对不能加 overflow-hidden
        // React Flow 的 resize 拖手定位在节点边框「外侧」（bottom:-4px / right:-4px），
        // 一旦 overflow:hidden 就把拖手裁掉 → 看不见也点不到 → 拖拽彻底失效。
        // 内容不溢出改由内容区自己负责（下面 textarea/div 都是 h-full + overflow-y-auto）。
        "group relative rounded-lg shadow-sm",
        // 2026-10-20：去掉 max-w-[400px]
        // 它会盖住 NodeResizer 的 maxWidth（600），导致"往大拖没反应"
        // 下限交给 style.minWidth，与 NodeResizer minWidth 保持一致
        isImage
          ? "bg-card border border-border"
          : "bg-amber-50 border border-amber-200/80",
        // 第六轮：选中态视觉克制 —— 白底 + 黑色细描边 + 阴影（参考用户给的草图）
        // 不再是 primary 蓝 ring，配合 NodeResizer 的 4 个蓝色空心 handle，整体观感更"卡片"
        selected && "shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
      )}
      data-testid="floating-node"
      style={{
        // 第五轮 BUG4b：这两个值只作为「首次渲染的初始尺寸」。
        // 一旦用户拖动，RF 的 setAttributes 会把实时尺寸写到 node wrapper 的 inline style，
        // 而 React 对未变化的 style prop 不会重写 → 所以拖动过程中视觉是实时跟手的。
        // （layout 里也把 width/height 放到了 node 顶层，两边保持一致）
        width: d.width ?? 220,
        height: d.height,
        minWidth: 140,
        minHeight: 80,
      }}
    >
      {/* Resizer（第六轮）：按用户草图改进
          - line 边线：黑色细边（更克制，不再是 primary 蓝）
          - 4 个角 handle：蓝色空心圆角方块（外蓝内白 = var(--background) 填充 + 蓝色边框）
          - handle 必须走 handleStyle：RF 的 ResizeControl 用 inline style 写 width/height，
            CSS className 会被覆盖（之前实测设 h-6 w-6 仍是 5×5）
          拖动实时由 RF 内部 XYResizer 完成（resizing 期间直接改 wrapper style），
          我们只在 onResizeEnd 落库，避开之前的 dimensions 写回 store 的死循环 */}
      <NodeResizer
        minWidth={140}
        minHeight={80}
        maxWidth={600}
        maxHeight={500}
        // 第六轮：明确的深灰近黑（Tailwind slate-700 = #374151）——
        // 用 RF 的 color prop 直接传 RGB 不被 class 解析影响。
        // 之前用 className border-foreground/40 实际渲染成蓝色（项目 --foreground 撞了 primary）。
        color="#374151"
        handleStyle={{
          width: 14,
          height: 14,
          borderRadius: 3,
          // 蓝色边框 + 白色内填 = "空心蓝方块"，整体观感比实心方块克制得多
          background: "var(--background)",
          border: "2px solid var(--primary)",
        }}
        handleClassName="nodrag nopan"
        isVisible={true}
        onResizeEnd={(_e, params) => {
          // 拖动过程 RF 已实时改 DOM；这里只把最终尺寸持久化到 store
          if (params.width != null && params.height != null) {
            useTodoStore
              .getState()
              .updateFloatingNode(id, { width: params.width, height: params.height });
          }
        }}
      />

      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !bg-amber-500 !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !bg-amber-500 !border-2 !border-background"
      />

      {editing ? (
        // 第五轮 BUG5a：图片节点以前编辑时图片整个消失（编辑态只渲染 textarea），
        // 等于图片没有"点击编辑"的逻辑。改成图片保留 + 下方一个小输入框改标题/注释。
        <div className="flex h-full flex-col overflow-y-auto px-3 py-2.5">
          {isImage && d.imageUrl ? (
            <div className="mb-2 flex min-h-0 flex-1 items-start justify-center">
              <img
                src={d.imageUrl}
                alt={d.title}
                className="block max-h-full max-w-full rounded object-contain"
                draggable={false}
              />
            </div>
          ) : null}
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // 2026-10-20：Enter 默认行为 = 加换行（textarea 默认）
              // 不再让 Enter 提交，让用户连续打字
              if (e.key === "Escape") {
                setDraft(d.title);
                setEditing(false);
                e.preventDefault();
              }
              // Cmd/Ctrl + Enter = 提交（强制保存）
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            placeholder={
              isImage
                ? "给图片写点说明（回车换行，Cmd+Enter 保存）"
                : "便签内容（每行一个 bullet，回车换行）"
            }
            className={cn(
              "block w-full resize-none bg-transparent outline-none text-sm leading-relaxed text-amber-950 placeholder:text-amber-400",
              // 文字便利贴：占满整块；图片便利贴：固定一小条，别把图挤没
              isImage ? "h-16 shrink-0 overflow-y-auto" : "min-h-[100px] flex-1 overflow-y-auto",
            )}
          />
        </div>
      ) : (
        <div className="flex h-full flex-col overflow-y-auto px-3 py-2.5 text-sm leading-relaxed text-amber-950">
          {isImage && d.imageUrl ? (
            // flex-1 + min-h-0：图片区占满剩余高度，img 的 max-h-full 才有确定的参照
            <div className="mb-2 flex min-h-0 flex-1 items-start justify-center">
              <img
                src={d.imageUrl}
                alt={d.title}
                // 2026-10-20：跟着便利贴尺寸走（原来写死 160px，
                // 便利贴拖小后图片装不下会被裁）
                className="block max-h-full max-w-full rounded object-contain"
                draggable={false}
              />
            </div>
          ) : null}
          {lines.length > 0 && lines[0] !== "" ? (
            <ul className="list-disc list-inside space-y-1">
              {lines.map((line, i) => (
                <li
                  key={i}
                  className="break-words whitespace-pre-wrap"
                >
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400 italic">
              <FileText className="h-3.5 w-3.5" />
              <span>（点击编辑）</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
FloatingNode.displayName = "FloatingNode";