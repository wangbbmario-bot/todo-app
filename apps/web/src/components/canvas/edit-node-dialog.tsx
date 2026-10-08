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
  onConfirm: (title: string) => void;
  onCancel: () => void;
}

/**
 * EditNodeDialog - 节点改名对话框
 *
 * 双击画板节点时弹出，输入框自动 focus，
 * Enter 提交，Esc 取消。
 */
export function EditNodeDialog({ open, initialTitle, onConfirm, onCancel }: EditNodeDialogProps) {
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改子任务名</DialogTitle>
          <DialogDescription>输入新的子任务名</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="子任务名"
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