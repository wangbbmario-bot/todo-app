"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import { Image as ImageIcon, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { LinkifiedText } from "@/components/ui/linkified-text";
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
        // 2026-11-02：w-full / h-full —— 填满 RF 的 node wrapper。
        //   wrapper 的 inline width/height 由 RF 在拖动时实时改写，
        //   内层填满它 = 便利贴本体跟着实时变大（详见下面 style 的注释）。
        "group relative h-full w-full rounded-lg shadow-sm",
        // 2026-10-20：去掉 max-w-[400px]
        // 它会盖住 NodeResizer 的 maxWidth（600），导致"往大拖没反应"
        // 下限交给 style.minWidth，与 NodeResizer minWidth 保持一致
        // 第六轮：选中态改成"白卡片"（参考用户草图：白底 + 深灰描边 + 阴影）
        // 必须用三元而不是 selected && "bg-card"：
        //   cn() 只是拼接 class 字符串，Tailwind 不看顺序来决定优先级 ——
        //   同一个元素上 bg-amber-50 和 bg-card 谁生效取决于 CSS 里 class 的定义顺序，
        //   不是 JSX 里谁写在后面。之前就因为这样导致"选中不变白"。
        isImage
          ? selected
            ? "bg-card border-2 border-neutral-400"
            : "bg-card border border-border"
          : selected
            ? "bg-card border-2 border-neutral-400"
            : "bg-amber-50 border border-amber-200/80",
      )}
      data-testid="floating-node"
      style={{
        // 2026-11-02 修「缩放要实时，不能等松手」：
        // 根因 —— RF 的 NodeResizer 拖动时通过 setAttributes 实时改 node.width/height，
        //   这两个值最终写进 **node wrapper**（.react-flow__node）的 inline style，
        //   所以 wrapper 是实时变大的（实测 300→311→322→…→389）。
        //   但这里原来写死了 width: d.width / height: d.height（来自 store 的旧值），
        //   React 每次重渲染都把内层 div 拽回旧尺寸 → 便利贴本体看起来「松手才变大」。
        //   而右下角 MiniMap 是实时的，因为它读的是 measured / node.width，不是这里的 style。
        //   → 用户看到的现象就是「预览窗实时、便签不实时」。
        // 修法 —— 内层不自己定尺寸，改为填满 wrapper（w-full h-full）。
        //   wrapper 的尺寸由 RF 唯一权威来源（node.width/height）驱动，
        //   拖动时 wrapper 变 → 内层跟着变 → 便签与 MiniMap 完全同步，且都是实时的。
        // 尺寸的「持久化」仍然只走 onResizeEnd（写 store），
        // 拖动过程中绝不写 store —— 否则会触发 use-mind-map-layout 重建 nodes、
        // 清空 measured → RF 反复重测 → 画板死循环变空白（第五轮 BUG4b 踩过）。
        minWidth: 140,
        minHeight: 80,
        // 第六轮：选中态阴影走 inline style，不用 Tailwind arbitrary class
        //   `shadow-[0_4px_12px_rgba(0,0,0,0.15)]` 里的逗号会被 Tailwind 当成分隔符解析，
        //   实测 boxShadow 算出来是全 0（= 没生效）。inline style 没有这层解析问题。
        ...(selected
          ? { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }
          : {}),
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
        // 边线：深灰近黑（#374151 = slate-700）
        // ⚠️ 两个坑叠在一起：
        //  1) 不能用 RF 的 color prop —— 它会同时把 handle 的 backgroundColor 也设成同色
        //     （`...(color && { [isHandleControl ? 'backgroundColor' : 'borderColor']: color })`），
        //     handle 的白底失效；`!important` 在 React inline style 里也没用。
        //  2) 只用 lineClassName 也不行 —— RF 自带 CSS 变量
        //     `--xy-resize-background-color-default: #3367d9`（蓝），
        //     优先级高于 Tailwind 生成的 class，边线永远是蓝的。
        // 所以边线走 lineStyle（inline style，优先级最高），handle 单独走 handleStyle。
        lineStyle={{ borderColor: "#374151" }}
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
                  {/* 2026-10-26：便利贴里的 URL 也渲染成可点击链接 */}
                  <LinkifiedText text={line} />
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