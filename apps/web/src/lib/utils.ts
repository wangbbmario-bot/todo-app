import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInDays, format, isToday, isTomorrow, isYesterday } from "date-fns";
import { zhCN } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化截止日期
 * 返回 { isOverdue, label }
 * - 已过期：红色，label 为 "X 天前" 或 "昨天" / "前天"
 * - 今天：蓝色，label 为 "今天"
 * - 明天：蓝色，label 为 "明天"
 * - 7 天内：蓝色，label 为 "周X" / "X月X日"
 * - 超过 7 天：蓝色，label 为 "X月X日"
 */
export function formatDueDate(dueAt: string | undefined | null): {
  isOverdue: boolean;
  label: string;
  fullDate: string;
} {
  if (!dueAt) return { isOverdue: false, label: "", fullDate: "" };

  const date = new Date(dueAt);
  const now = new Date();
  const days = differenceInDays(date, now);
  const fullDate = format(date, "yyyy-MM-dd HH:mm", { locale: zhCN });

  if (isToday(date)) {
    return { isOverdue: false, label: "今天", fullDate };
  }
  if (isTomorrow(date)) {
    return { isOverdue: false, label: "明天", fullDate };
  }
  if (isYesterday(date)) {
    return { isOverdue: true, label: "昨天", fullDate };
  }

  if (days < 0) {
    // 已过期
    if (days >= -7) {
      return { isOverdue: true, label: `${-days} 天前`, fullDate };
    }
    return { isOverdue: true, label: format(date, "M月d日", { locale: zhCN }), fullDate };
  }

  // 未过期
  if (days <= 7) {
    return { isOverdue: false, label: format(date, "M月d日 EEE", { locale: zhCN }), fullDate };
  }
  return { isOverdue: false, label: format(date, "M月d日", { locale: zhCN }), fullDate };
}

/**
 * 格式化截止日期（短版，用于徽章）
 * - 过期红 / 未到期蓝
 */
export function formatDateLabel(dueAt: string): { isOverdue: boolean; label: string; fullDate: string } {
  const date = new Date(dueAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} 23:59`;

  if (diffDays === 0) return { isOverdue: false, label: "今天", fullDate };
  if (diffDays === 1) return { isOverdue: false, label: "明天", fullDate };
  if (diffDays === -1) return { isOverdue: true, label: "昨天", fullDate };
  if (diffDays < 0) return { isOverdue: true, label: `${-diffDays}天前`, fullDate };
  if (diffDays <= 7) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return { isOverdue: false, label: weekdays[date.getDay()], fullDate };
  }
  return {
    isOverdue: false,
    label: `${date.getMonth() + 1}月${date.getDate()}日`,
    fullDate,
  };
}

/**
 * 格式化时间（用于"完成时间"/"删除时间"展示）
 * - 刚刚 / X分钟前 / X小时前 / X天前 / M/D
 */
export function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 计算今天/明天/一周后某时刻 23:59:59 的 ISO 字符串
 */
export function endOfDayISO(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}
