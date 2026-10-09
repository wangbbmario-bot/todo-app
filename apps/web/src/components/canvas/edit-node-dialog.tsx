"use client";
/* eslint-disable react-hooks/set-state-in-effect -- 对话框打开时同步外部 prop */

import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditNodeDialogProps {
  open: boolean;
  initialTitle: string;
  kind: "subtask" | "floating"; // 决定标题文案
  onConfirm: (title: string) => void;
  onCancel: () => void;
}

/**
 * EditNodeDialog - 节点改名对话框
 *
 * 双击画板节点时弹出，输入框自动 focus，
 * Enter 提交，Esc 取消。
 *
 * 2026-10-09 改造：支持改名子任务和游离节点（之前只支持子任务，游离节点双击没反应）
 */
export function EditNodeDialog({ open, initialTitle, kind, onConfirm, onCancel }: EditNodeDialogProps) {
  const [title, setTitle] = useState(initialTitle);

  // 每次打开时重置 title
  useEffect(() => {
    if (open) setTitle(initialTitle);
  }, [open, initialTitle]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (title.trim()) {
      onConfirm(title.trim());
    }
  };

  const TITLE = kind === "subtask" ? "修改子任务名" : "修改游离节点";
  const DESC = kind === "subtask" ? "输入新的子任务名" : "输入新的游离节点名";
  const PH = kind === "subtask" ? "子任务名" : "节点内容";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{DESC}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={PH}
            className="mt-2"
            data-testid="edit-node-input"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              确定
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}