export type DeveloperErrorStatus = "IN_PROGRESS" | "OPEN" | "RESOLVED";

export type DeveloperErrorLogItem = {
  appState: Record<string, unknown>;
  browserInfo: Record<string, unknown>;
  createdAt: string;
  id: string;
  level: string;
  message: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  routePath: string | null;
  screenshotData: string | null;
  screenshotUrl: string | null;
  source: string;
  stack: string | null;
  status: DeveloperErrorStatus;
  userEmail: string | null;
  userId: string | null;
  userRole: string | null;
};

export type DeveloperErrorLogInput = {
  appState?: Record<string, unknown>;
  browserInfo?: Record<string, unknown>;
  level?: string;
  message: string;
  routePath?: string | null;
  screenshotData?: string | null;
  screenshotUrl?: string | null;
  source?: string;
  stack?: string | null;
};

export type DeveloperErrorLogUpdateInput = {
  resolutionNote?: string | null;
  status?: DeveloperErrorStatus;
};
