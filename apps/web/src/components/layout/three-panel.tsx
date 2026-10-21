"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { List, CheckSquare, Network, ChevronLeft, KeyRound, LogOut, MoreVertical } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { useTodoStore, useSelectedList } from "@/lib/stores/todo-store";
import { ListPanel } from "@/components/panels/list-panel";
import { TaskPanel } from "@/components/panels/task-panel";
import { BoardPanel } from "@/components/panels/board-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { cn } from "@/lib/utils";
import { isGuestSession } from "@/lib/auth/guest";

/**
 * 2026-10-21：构造「当前域名」的登录页绝对 URL
 *
 * 之前直接写 `signOut({ callbackUrl: "/login" })`，但相对路径会被 NextAuth
 * 用 NEXTAUTH_URL 环境变量补全 —— 而线上 NEXTAUTH_URL = http://47.107.46.78.nip.io，
 * 于是用户从 https://juststartit.cn 点「去登录」，被弹到 nip.io（而且是 HTTP，
 * cookie domain 和 juststartit.cn 不通用，看起来像数据全丢了）。
 * 顺带把 authjs.callback-url cookie 也污染成 nip.io，影响后续登录。
 *
 * 修法：显式传当前 window.location.origin 的绝对 URL，NextAuth 不再猜。
 */
function absoluteLoginUrl(): string {
  if (typeof window === "undefined") return "/login";
  return `${window.location.origin}/login`;
}

type MobileTab = "lists" | "tasks" | "board";

export function ThreePanelLayout() {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<MobileTab>("lists");

  if (isMobile === null) {
    // 首次加载，避免闪烁
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (isMobile) {
    return <MobileLayout activeTab={mobileTab} setActiveTab={setMobileTab} />;
  }

  return <DesktopLayout />;
}

/**
 * 应用 Logo + 账号菜单
 * 用 Popover 实现 hover 触发（鼠标进入 trigger 或 menu 内容都保持打开，
 * 鼠标离开整个 menu 才关闭）。Radix Popover 默认是 click 触发，
 * 我们通过 onOpenChange + open 手动控制。
 */
function AppLogoMenu({
  phone,
  isGuest,
  onChangePassword,
  onGoLogin,
}: {
  phone: string;
  // 第六轮：游客模式（用 isGuest 标识，共享常量 lib/auth/guest.ts 里 GUEST_PHONE）
  isGuest?: boolean;
  onChangePassword: () => void;
  // 游客点击「去登录」跳 /login；正常账号点「退出登录」调 signOut()
  onGoLogin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click 外部关闭菜单（hover 实现不稳定，改用 click + 外部点击关闭）
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded px-1 py-0.5 text-sm font-semibold transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="app-menu-trigger"
      >
        Todo App
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          v0.3.0
        </span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md"
          data-testid="app-menu-content"
          role="menu"
        >
          {/* 游客模式：不显示账号（避免暴露测试号）+ 不显示修改密码（避免误改共享账号的密码） */}
          {!isGuest && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground" data-testid="app-menu-phone">
              {phone}
            </div>
          )}
          {!isGuest && (
            <button
              type="button"
              onClick={() => {
                onChangePassword();
                setOpen(false);
              }}
              className="flex w-full items-center rounded px-2 py-1.5 text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              data-testid="app-menu-change-password"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              修改密码
            </button>
          )}
          {!isGuest && <div className="my-1 h-px bg-border" />}
          <button
            type="button"
            onClick={() => {
              // 游客：跳到登录页（用账号登录或注册）
              // 正常账号：调用 signOut({ callbackUrl: "/login" })
              onGoLogin();
              setOpen(false);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-sm hover:bg-accent focus:bg-accent focus:outline-none"
            data-testid="app-menu-signout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isGuest ? "去登录" : "退出登录"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============== 桌面布局 ==============
function DesktopLayout() {
  const layout = useTodoStore((s) => s.layout);
  const setLayout = useTodoStore((s) => s.setLayout);
  const { data: session } = useSession();
  const [changePwOpen, setChangePwOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* 顶部工具栏（仅桌面） */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          {/* 应用 Logo 下拉：hover 触发修改密码 / 退出登录 */}
          {session?.user ? (
            <AppLogoMenu
              phone={session.user.phone ?? ""}
              isGuest={isGuestSession(session.user.phone)}
              onChangePassword={() => setChangePwOpen(true)}
              onGoLogin={() => signOut({ callbackUrl: absoluteLoginUrl() })}
            />
          ) : (
            <h1 className="text-sm font-semibold">Todo App</h1>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="todo-three-panel">
          <Panel
            defaultSize={layout.leftWidth}
            minSize={15}
            maxSize={35}
            onResize={(size) => setLayout({ leftWidth: size })}
            className="bg-muted/30"
          >
            <ListPanel />
          </Panel>

          <PanelResizeHandle className="w-1 bg-border transition-colors hover:bg-primary/50 data-[resize-handle-state=drag]:bg-primary" />

          <Panel
            defaultSize={layout.middleWidth}
            minSize={20}
            maxSize={40}
            onResize={(size) => setLayout({ middleWidth: size })}
          >
            <TaskPanel />
          </Panel>

          <PanelResizeHandle className="w-1 bg-border transition-colors hover:bg-primary/50 data-[resize-handle-state=drag]:bg-primary" />

          <Panel
            defaultSize={layout.rightWidth}
            minSize={30}
            onResize={(size) => setLayout({ rightWidth: size })}
          >
            <BoardPanel />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

// ============== 移动布局 ==============
interface MobileLayoutProps {
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
}

function MobileLayout({ activeTab, setActiveTab }: MobileLayoutProps) {
  const selectedList = useSelectedList();
  const selectedTaskId = useTodoStore((s) => s.selectedTaskId);
  const { data: session } = useSession();
  // 2026-10-20：mobile header 也需要"改密 / 登出"入口
  //   之前只有 ThemeToggle，没有头像菜单 → mobile 用户无法改密、无法登出、被锁死
  const [changePwOpen, setChangePwOpen] = useState(false);

  // 选中清单或任务时，自动跳到对应 Tab
  useEffect(() => {
    if (selectedList && activeTab === "lists") {
      // 用户从 lists 选了清单，跳到 tasks
      // （这里不强制，让用户控制）
    }
  }, [selectedList?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      {/* 顶部 */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        {/* 移动端面包屑：当前 Tab + 返回按钮 */}
        {activeTab !== "lists" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              if (activeTab === "board") setActiveTab("tasks");
              else if (activeTab === "tasks") setActiveTab("lists");
            }}
            title="返回上一级"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1 truncate px-2 text-sm font-medium">
          {activeTab === "lists" && "清单列表"}
          {activeTab === "tasks" && (selectedList?.name ?? "任务")}
          {activeTab === "board" && (selectedList?.name ?? "画板")}
        </div>
        <ThemeToggle />
        {session?.user && (
          <MobileAppMenu
            phone={session.user.phone ?? ""}
            isGuest={isGuestSession(session.user.phone)}
            onChangePassword={() => setChangePwOpen(true)}
            onGoLogin={() => signOut({ callbackUrl: absoluteLoginUrl() })}
          />
        )}
      </div>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "lists" && <ListPanel />}
        {activeTab === "tasks" && (
          // 移动端没有左栏，自动选中第一个清单
          <TaskPanelWithAutoSelect />
        )}
        {activeTab === "board" && (
          <div className="h-full">
            <BoardPanel />
          </div>
        )}
      </div>

      {/* 底部 Tab 栏 */}
      <div className="flex h-12 shrink-0 items-center justify-around border-t bg-background">
        <MobileTabButton
          active={activeTab === "lists"}
          onClick={() => setActiveTab("lists")}
          icon={List}
          label="清单"
        />
        <MobileTabButton
          active={activeTab === "tasks"}
          onClick={() => {
            if (selectedList) setActiveTab("tasks");
            else setActiveTab("lists");
          }}
          icon={CheckSquare}
          label="任务"
        />
        <MobileTabButton
          active={activeTab === "board"}
          onClick={() => {
            if (selectedTaskId) setActiveTab("board");
            else if (selectedList) setActiveTab("tasks");
            else setActiveTab("lists");
          }}
          icon={Network}
          label="画板"
        />
      </div>
    </div>
  );
}

function MobileTabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs transition-colors",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
      data-testid={`mobile-tab-${label === "清单" ? "lists" : label === "任务" ? "tasks" : "board"}`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
}

// 2026-10-20：移动端头像菜单（MoreVertical 触发）
// 桌面有 AppLogoMenu，但 mobile header 空间有限不能塞文字 trigger。
// 这里独立一份，dropdown 内容（手机号/改密/登出）和桌面完全一致。
function MobileAppMenu({
  phone,
  isGuest,
  onChangePassword,
  onGoLogin,
}: {
  phone: string;
  // 第六轮：游客模式隐藏账号/改密
  isGuest?: boolean;
  onChangePassword: () => void;
  onGoLogin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点外面关闭（桌面 AppLogoMenu 没有这个处理，触屏更容易点飞）
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-1 flex h-7 w-7 items-center justify-center rounded hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="app-menu-trigger"
        aria-label="应用菜单"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md"
          data-testid="app-menu-content"
          role="menu"
        >
          {/* 游客模式：不显示手机号 + 改密；操作改成"去登录" */}
          {!isGuest && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">{phone}</div>
          )}
          {!isGuest && (
            <button
              type="button"
              onClick={() => {
                onChangePassword();
                setOpen(false);
              }}
              className="flex w-full items-center rounded px-2 py-1.5 text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              data-testid="app-menu-change-password"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              修改密码
            </button>
          )}
          {!isGuest && <div className="my-1 h-px bg-border" />}
          <button
            type="button"
            onClick={() => {
              onGoLogin();
              setOpen(false);
            }}
            className="flex w-full items-center rounded px-2 py-1.5 text-sm hover:bg-accent focus:bg-accent focus:outline-none"
            data-testid="app-menu-signout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isGuest ? "去登录" : "退出登录"}
          </button>
        </div>
      )}
    </div>
  );
}

// 移动端 task-panel：自动选中
function TaskPanelWithAutoSelect() {
  const selectedList = useSelectedList();
  const selectList = useTodoStore((s) => s.selectList);

  // 2026-10-20：mobile 任务 tab 之前一直白屏崩溃的根因
  //   旧代码：const userLists = useTodoStore((s) => s.lists.filter(...))
  //   selector 每次返回新数组 → 组件每次渲染引用都变
  //   → useEffect([selectedList, userLists, selectList]) 反复触发
  //   → selectList 再 setState → 再渲染 → 死循环 → 浏览器强制 unload
  // 修法：拿数据用 getState() 一次性快照，且不放进 useEffect 依赖。
  useEffect(() => {
    if (!selectedList) {
      const firstList = useTodoStore
        .getState()
        .lists.find((l) => l.kind === "LIST");
      if (firstList) selectList(firstList.id);
    }
  }, [selectedList, selectList]);

  return <TaskPanel />;
}

// ============== Hook ==============
function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}
