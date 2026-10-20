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
        "group relative min-w-[180px] max-w-[400px] rounded-lg shadow-sm",
        // 便利贴黄底配色
        isImage
          ? "bg-card border border-border"
          : "bg-amber-50 border border-amber-200/80",
        selected && "ring-2 ring-primary/40",
      )}
      data-testid="floating-node"
      style={{
        width: d.width ?? 220,
        minHeight: d.height ?? 140,
      }}
    >
      {/* Resizer - 右下角拖手 */}
      <NodeResizer
        minWidth={140}
        minHeight={80}
        maxWidth={600}
        maxHeight={500}
        lineClassName="border-amber-400"
        handleClassName="h-3 w-3 bg-amber-400 border-amber-600 rounded"
        isVisible={selected}
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
            if (e.key === "Escape") {
              setDraft(d.title);
              setEditing(false);
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="便签内容（每行一个 bullet）"
          className="block w-full h-full min-h-[100px] bg-transparent resize-none outline-none px-3 py-2 text-sm leading-relaxed text-amber-950 placeholder:text-amber-400"
        />
      ) : (
        <div className="px-3 py-2.5 text-sm leading-relaxed text-amber-950">
          {isImage && d.imageUrl ? (
            <div className="mb-2">
              <img
                src={d.imageUrl}
                alt={d.title}
                className="block max-h-[160px] w-auto rounded object-contain"
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