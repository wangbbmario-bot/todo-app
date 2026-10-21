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
        // 第五轮 BUG4a：选中态改成蓝色描边 + 蓝色圆角方块拖手（原来的实心琥珀色小方块太丑）
        selected && "ring-2 ring-primary",
      )}
      data-testid="floating-node"
      style={{
        width: d.width ?? 220,
        // 2026-10-20：height 而不是 minHeight
        // minHeight 会挡住"往小拖"，拖到比 d.height 更小就没反应了
        height: d.height,
        minWidth: 140,
        minHeight: 80,
      }}
    >
      {/* Resizer（第五轮 BUG4a）：蓝色描边 + 蓝色圆角方块拖手
          - lineClassName 决定 4 条边的描边（用户嫌原来的实心方块丑）
          - handleStyle 的 width/height 必须走 inline style，className 会被覆盖（见下方注释）
          - 圆角通过 borderRadius 内联设置，比 rounded class 更可控
          BUG4b：拖动实时生效由 RF 内部 XYResizer 完成（resizing 期间直接改 node dimensions，
                 DOM 立刻跟着变），我们只在 onResizeEnd 落库，避免之前的 dimensions 死循环 */}
      <NodeResizer
        minWidth={140}
        minHeight={80}
        maxWidth={600}
        maxHeight={500}
        lineClassName="border-primary"
        // 必须用 handleStyle 设宽高 + 颜色：RF 的 ResizeControl 渲染时写
        // `style: { ...style, scale, ... }`，inline style 的 specificity 高于 CSS class，
        // 所以 className 里的 h-3/w-3/bg-* 永远不生效（之前实测设 h-6 w-6 仍是 5×5）
        handleStyle={{
          width: 14,
          height: 14,
          borderRadius: 4,
          background: "hsl(var(--primary))",
          border: "2px solid hsl(var(--primary))",
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