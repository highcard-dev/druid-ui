export interface RoutingStrategy {
  getCurrentPath(): string;
  navigateTo(path: string): void;
}

export class HistoryRoutingStrategy implements RoutingStrategy {
  getCurrentPath(): string {
    return window.location.pathname;
  }

  navigateTo(path: string): void {
    window.history.pushState({}, "", path);
  }
}

export class CustomRoutingStrategy implements RoutingStrategy {
  private currentPath: string = "/";

  getCurrentPath(): string {
    return this.currentPath;
  }

  navigateTo(path: string): void {
    this.currentPath = path;
  }
}

export const createRoutingStrategy = (
  mode: "history" | "custom"
): RoutingStrategy => {
  if (mode === "custom") {
    return new CustomRoutingStrategy();
  } else {
    return new HistoryRoutingStrategy();
  }
};
