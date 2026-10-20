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
        selected && "ring-2 ring-primary/40",
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
      {/* Resizer - 右下角拖手（2026-10-20：始终可见，不依赖 selected） */}
      <NodeResizer
        minWidth={140}
        minHeight={80}
        maxWidth={600}
        maxHeight={500}
        lineClassName="border-amber-400"
        // 2026-10-20：必须用 handleStyle 设宽高，不能用 Tailwind className
        //   RF 的 ResizeControl 渲染时写 `style: { ...style, scale, ... }`，width/height 走 inline，
        //   inline style specificity > CSS class → className 的 h-6/w-6 永远不生效（实测仍 5×5）
        //   24×24 是 mobile 触摸目标（Apple HIG 44 但桌面不卡）；桌面也用 24 而非 12（少一处条件分支）
        handleStyle={{ width: 24, height: 24 }}
        handleClassName="bg-amber-400 border-2 border-amber-600 rounded"
        isVisible={true}
        onResizeEnd={(_e, params) => {
          // 兜底：直接把最终尺寸写回 store
          // （onNodesChange 的 dimensions 分支已覆盖，这里双保险，幂等无害）
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
          placeholder="便签内容（每行一个 bullet，回车换行）"
          className="block h-full w-full resize-none overflow-y-auto bg-transparent outline-none px-3 py-2 text-sm leading-relaxed text-amber-950 placeholder:text-amber-400"
        />
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