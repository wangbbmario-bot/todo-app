"use client";

import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * LinkifiedText - 把文本里的 URL 渲染成可点击链接
 *
 * 2026-10-26：任务/子任务名里经常直接粘 URL（比如飞书文档链接），
 * 之前是纯文本，用户要点开得手动复制到地址栏。
 *
 * 设计要点：
 * 1. 只在【展示态】生效，编辑态（input/textarea）保持纯文本，方便正常编辑。
 * 2. 点击链接时 stopPropagation —— 否则会连带触发外层的
 *    「单击标题进入编辑」/「单击节点选中」/「React Flow 拖拽节点」。
 *    鼠标按下也要拦（onMouseDown），否则拖拽节点会把点击吃掉。
 * 3. 只认 http/https，别的协议（javascript: 等）不当链接渲染，避免 XSS。
 */

/** 匹配 http/https 开头的 URL */
const URL_PATTERN = /https?:\/\/[^\s]+/g;

/** URL 末尾的标点不应该算进链接里 */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>'"。，、；：！？）】》」』]+$/;

/** 从一段文本里切出 [普通文本, 链接, 普通文本, 链接, ...] */
function splitByUrl(text: string): { text: string; isUrl: boolean }[] {
  const out: { text: string; isUrl: boolean }[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];

    // 结尾的标点切出去（但要保证 URL 本体非空）
    const trimmed = raw.replace(TRAILING_PUNCTUATION, "");
    const trailing = raw.slice(trimmed.length);
    if (!trimmed) continue;

    if (start > lastIndex) {
      out.push({ text: text.slice(lastIndex, start), isUrl: false });
    }
    out.push({ text: trimmed, isUrl: true });
    if (trailing) out.push({ text: trailing, isUrl: false });
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    out.push({ text: text.slice(lastIndex), isUrl: false });
  }

  return out;
}

export function LinkifiedText({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;

  const parts = splitByUrl(text);
  if (parts.length === 0) return null;

  return (
    <span className={cn("min-w-0", className)}>
      {parts.map((part, i) =>
        part.isUrl ? (
          <a
            key={i}
            href={part.text}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-70 break-all"
            title={part.text}
            // 拦住冒泡：不让外层的「进入编辑」「选中」「拖拽」被触发
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {part.text}
          </a>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </span>
  );
}
