export interface RoutingStrategy {
  getCurrentPath(): string;
  navigateTo(path: string): void;
  onPathChange(callback: (newPath: string) => void): void;
}

export class HistoryRoutingStrategy implements RoutingStrategy {
  constructor() {
    window.addEventListener("popstate", () => {
      this.notifyPathChange();
    });
  }

  getCurrentPath(): string {
    return window.location.pathname;
  }

  navigateTo(path: string): void {
    window.history.pushState({}, "", path);
    this.notifyPathChange();
  }

  private pathChangeCallbacks: ((newPath: string) => void)[] = [];

  onPathChange(callback: (newPath: string) => void): void {
    this.pathChangeCallbacks.push(callback);
  }

  private notifyPathChange() {
    const newPath = this.getCurrentPath();
    this.pathChangeCallbacks.forEach((cb) => cb(newPath));
  }
}

export class CustomRoutingStrategy implements RoutingStrategy {
  private currentPath: string = "/";
  private pathChangeCallbacks: ((newPath: string) => void)[] = [];

  getCurrentPath(): string {
    return this.currentPath;
  }

  navigateTo(path: string): void {
    this.currentPath = path;
    this.notifyPathChange();
  }

  onPathChange(callback: (newPath: string) => void): void {
    this.pathChangeCallbacks.push(callback);
  }

  private notifyPathChange() {
    this.pathChangeCallbacks.forEach((cb) => cb(this.currentPath));
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
