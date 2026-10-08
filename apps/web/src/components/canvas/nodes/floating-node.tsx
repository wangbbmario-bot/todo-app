"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Image as ImageIcon, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { type FloatingNodeData } from "./types";

/**
 * FloatingNode - 画板游离节点（BUG-9 / BUG-10）
 *
 * 不连接到任何其他节点，可自由拖动。可作为其他节点的子节点或同级节点。
 * 支持 TEXT（文本）和 IMAGE（图片）两种 kind。
 */

export const FloatingNode = memo(({ data, selected }: NodeProps) => {
  const d = data as FloatingNodeData;
  const isImage = d.kind === "IMAGE";

  return (
    <div
      className={cn(
        "group min-w-[160px] max-w-[280px] rounded-lg border bg-card px-3 py-2 shadow-sm transition-all",
        selected
          ? "border-primary shadow-md"
          : "border-border hover:border-primary/60",
      )}
      data-testid="floating-node"
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !bg-muted-foreground !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !bg-muted-foreground !border-2 !border-background"
      />
      <div className="flex items-start gap-2">
        {isImage ? (
          <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          {isImage && d.imageUrl ? (
            <img
              src={d.imageUrl}
              alt={d.title}
              className="block max-h-[160px] w-auto rounded object-contain"
            />
          ) : null}
          <p className="break-words text-xs leading-relaxed text-foreground">
            {d.title || <span className="text-muted-foreground">（空）</span>}
          </p>
        </div>
      </div>
    </div>
  );
});
FloatingNode.displayName = "FloatingNode";