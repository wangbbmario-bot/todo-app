"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatDueDate } from "@/lib/utils";

interface DueDatePickerProps {
  value: string | undefined;
  onChange: (value: string | null) => void;
  className?: string;
  compact?: boolean; // compact 模式只显示图标
}

export function DueDatePicker({ value, onChange, className, compact }: DueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;
  const { isOverdue, label } = formatDueDate(value);

  const handleSelect = (selected: Date | undefined) => {
    if (selected) {
      // 设置为当天 23:59:59（用户一天的截止点）
      const d = new Date(selected);
      d.setHours(23, 59, 59, 0);
      onChange(d.toISOString());
    } else {
      onChange(null);
    }
    setOpen(false);
  };

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "rounded p-1 transition-colors hover:bg-muted",
              date && (isOverdue ? "text-date-overdue" : "text-date-upcoming"),
              !date && "text-muted-foreground",
              className,
            )}
            title={date ? `截止：${label}` : "设置截止日期"}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
          />
          {date && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                清除截止日期
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            date && (isOverdue ? "text-date-overdue" : "text-date-upcoming"),
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? label : "设置截止日期"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
        />
        {date && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              清除截止日期
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
