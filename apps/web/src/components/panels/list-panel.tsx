"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Pin, Trash2, Edit2, GripVertical, User as UserIcon } from "lucide-react";

import {
  useTodoStore,
  useUserLists,
  useSystemLists,
  useTaskCountForList,
} from "@/lib/stores/todo-store";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { List } from "@/lib/types";

export function ListPanel() {
  const userLists = useUserLists();
  const systemLists = useSystemLists();
  const { data: session } = useSession();
  const selectedListId = useTodoStore((s) => s.selectedListId);
  const selectList = useTodoStore((s) => s.selectList);
  const createList = useTodoStore((s) => s.createList);
  const renameList = useTodoStore((s) => s.renameList);
  const pinList = useTodoStore((s) => s.pinList);
  const deleteList = useTodoStore((s) => s.deleteList);
  const reorderLists = useTodoStore((s) => s.reorderLists);

  // 排序：pinned 优先，然后按 order
  const sortedUserLists = [...userLists].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.order - b.order;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedUserLists.findIndex((l) => l.id === active.id);
    const newIndex = sortedUserLists.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(sortedUserLists, oldIndex, newIndex);
    reorderLists(reordered.map((l) => l.id));
  };

  // BUG-2(z1-2)：按回车键新建清单（Notion 风格）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.altKey) return;
    const target = e.target as HTMLElement;
    // 在 input/textarea 里回车不触发（避免冲突）
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    e.preventDefault();
    const newId = createList();
    selectList(newId);
  };

  return (
    <div
      className="flex h-full flex-col"
      data-testid="list-panel"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">清单列表</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            data-testid="new-list-button"
            onClick={() => {
              const newId = createList();
              selectList(newId);
            }}
            title="新建清单（默认名随机水果）"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 列表区 */}
      <ScrollArea
        // 2026-10-26：同样要 min-h-0（清单多了也滚不动，根因同 task-panel）
        className="min-h-0 flex-1 scrollbar-thin"
      >
        <div className="space-y-1 p-2">
          {/* 用户清单 - 可拖动排序 */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedUserLists.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedUserLists.map((list) => (
                <SortableListItem
                  key={list.id}
                  list={list}
                  isSelected={selectedListId === list.id}
                  onSelect={() => selectList(list.id)}
                  onRename={(name) => renameList(list.id, name)}
                  onPin={() => pinList(list.id)}
                  onDelete={() => deleteList(list.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* 系统区段：已完成、垃圾桶 - 不可拖动 */}
          {systemLists.map((list) => (
            <ListItem
              key={list.id}
              list={list}
              isSelected={selectedListId === list.id}
              onSelect={() => selectList(list.id)}
              onRename={undefined}
              onPin={undefined}
              onDelete={undefined}
              dragHandle={null}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ========== 可拖动列表项 ==========
interface ListItemProps {
  list: List;
  isSelected: boolean;
  onSelect: () => void;
  onRename?: (name: string) => void;
  onPin?: () => void;
  onDelete?: () => void;
  dragHandle?: React.ReactNode;
}

function ListItem({ list, isSelected, onSelect, onRename, onPin, onDelete, dragHandle }: ListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(list.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const taskCount = useTaskCountForList(list.id);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSubmitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== list.name) {
      onRename?.(trimmed);
    } else {
      setEditValue(list.name);
    }
    setIsEditing(false);
  };

  const item = (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isSelected
          ? "bg-primary/10 text-foreground"
          : "text-foreground/80 hover:bg-muted",
      )}
      data-testid="list-item"
      onClick={() => !isEditing && onSelect()}
      onDoubleClick={() => onRename && setIsEditing(true)}
    >
      {/* 拖动手柄 */}
      {dragHandle && <span className="shrink-0">{dragHandle}</span>}

      {/* 颜色标识 */}
      {!dragHandle && (
        <span
          className="h-3 w-3 shrink-0 rounded-sm"
          style={{ backgroundColor: list.color }}
        />
      )}
      {dragHandle && (
        <span
          className="h-3 w-3 shrink-0 rounded-sm"
          style={{ backgroundColor: list.color }}
        />
      )}

      {/* 名字 / 编辑框 */}
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmitRename();
            if (e.key === "Escape") {
              setEditValue(list.name);
              setIsEditing(false);
            }
          }}
          className="h-6 px-1 py-0 text-sm"
          data-testid="list-rename-input"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate">
          {list.pinned && (
            <Pin className="mr-1 inline h-3 w-3 -translate-y-0.5 text-primary" />
          )}
          {list.name}
        </span>
      )}

      {/* 任务数 */}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {taskCount}
      </span>
    </div>
  );

  if (!onRename && !onPin && !onDelete) {
    return item;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{item}</ContextMenuTrigger>
      <ContextMenuContent>
        {onRename && (
          <ContextMenuItem onSelect={() => setIsEditing(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            重命名
          </ContextMenuItem>
        )}
        {onPin && (
          <ContextMenuItem onSelect={onPin}>
            <Pin className="mr-2 h-4 w-4" />
            {list.pinned ? "取消置顶" : "置顶"}
          </ContextMenuItem>
        )}
        {onDelete && (
          <>
            {onRename || onPin ? <ContextMenuSeparator /> : null}
            <ContextMenuItem
              onSelect={onDelete}
              className="text-destructive"
              data-testid="context-delete"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ========== 可拖动包装 ==========
interface SortableListItemProps {
  list: List;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onPin: () => void;
  onDelete: () => void;
}

function SortableListItem(props: SortableListItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.list.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ListItem
        {...props}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground/40 hover:text-foreground active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            title="拖动排序"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        }
      />
    </div>
  );
}
