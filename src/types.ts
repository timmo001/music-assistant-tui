export type ViewId = "player" | "menu" | "setup" | "submenu";

export interface NoopAction {
  readonly type: "noop";
}

export interface SubmenuAction {
  readonly type: "submenu";
  readonly menuId: string;
}

export interface QuitAction {
  readonly type: "quit";
}

export type MenuAction = NoopAction | SubmenuAction | QuitAction;

export interface MenuItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly action: MenuAction;
  readonly keywords?: readonly string[];
  readonly group?: string;
}
