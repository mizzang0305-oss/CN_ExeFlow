"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildDepartmentDirectiveCacheKey,
  type CeoDirectiveScope,
  type DirectiveStatusValue,
} from "@/lib/constants/status-labels";

export type DepartmentDirectiveItem = {
  created_at: string;
  department_name: string | null;
  directive_no: string;
  id: string;
  is_urgent: boolean;
  status: DirectiveStatusValue;
  title: string;
  updated_at: string | null;
  urgent_level: string | number | null;
};

export type DepartmentDirectivesResponse = {
  department: {
    id: string;
    name: string;
  };
  filter: {
    status: DirectiveStatusValue | null;
    urgent: boolean;
  };
  hasMore: boolean;
  items: DepartmentDirectiveItem[];
  limit: number;
  page: number;
};

export type DepartmentDirectiveRequest = {
  departmentId: string | null;
  limit?: number;
  page?: number;
  scope?: CeoDirectiveScope | "none";
  status?: DirectiveStatusValue | null;
  urgent?: boolean;
};

type HookState = {
  cacheKey: string | null;
  data: DepartmentDirectivesResponse | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
};

const directiveCache = new Map<string, DepartmentDirectivesResponse>();
const prefetchRequests = new Map<string, Promise<DepartmentDirectivesResponse | null>>();
const MIN_VISIBLE_LOADING_MS = 420;

function normalizeRequest(request: DepartmentDirectiveRequest) {
  const scope = request.scope ?? (request.departmentId ? "department" : "none");

  return {
    departmentId: request.departmentId ?? "",
    limit: request.limit ?? 50,
    page: request.page ?? 1,
    scope,
    status: request.status ?? null,
    urgent: request.urgent === true,
  };
}

function canFetchRequest(
  request: ReturnType<typeof normalizeRequest>,
): request is ReturnType<typeof normalizeRequest> & { scope: CeoDirectiveScope } {
  return request.scope !== "none" && (request.scope === "global" || Boolean(request.departmentId));
}

function buildRequestUrl(request: ReturnType<typeof normalizeRequest>) {
  const params = new URLSearchParams({
    limit: String(request.limit),
    page: String(request.page),
  });

  if (request.scope !== "none") {
    params.set("scope", request.scope);
  }

  if (request.departmentId) {
    params.set("departmentId", request.departmentId);
  }

  if (request.status) {
    params.set("status", request.status);
  }

  if (request.urgent) {
    params.set("urgent", "true");
  }

  return `/api/ceo/directives?${params.toString()}`;
}

async function readDirectiveResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | DepartmentDirectivesResponse
    | { ok: false; error?: { message?: string } }
    | { ok: true; data: DepartmentDirectivesResponse }
    | null;

  if (!response.ok) {
    const message = payload && "ok" in payload && payload.ok === false
      ? payload.error?.message
      : null;
    throw new Error(message ?? "지시사항을 불러오지 못했습니다.");
  }

  if (payload && "ok" in payload) {
    if (payload.ok) {
      return payload.data;
    }

    throw new Error(payload.error?.message ?? "지시사항을 불러오지 못했습니다.");
  }

  if (!payload || !("items" in payload)) {
    throw new Error("지시사항 응답을 확인하지 못했습니다.");
  }

  return payload;
}

async function fetchDepartmentDirectives(
  request: ReturnType<typeof normalizeRequest>,
  signal?: AbortSignal,
) {
  const response = await fetch(buildRequestUrl(request), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  return readDirectiveResponse(response);
}

function waitForMinimumLoading(startedAt: number) {
  const remaining = MIN_VISIBLE_LOADING_MS - (Date.now() - startedAt);

  if (remaining <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => window.setTimeout(resolve, remaining));
}

export function useDepartmentDirectives(request: DepartmentDirectiveRequest) {
  const normalizedRequest = useMemo(
    () => ({
      departmentId: request.departmentId ?? "",
      limit: request.limit ?? 50,
      page: request.page ?? 1,
      scope: request.scope ?? (request.departmentId ? "department" : "none"),
      status: request.status ?? null,
      urgent: request.urgent === true,
    }),
    [request.departmentId, request.limit, request.page, request.scope, request.status, request.urgent],
  );
  const cacheKey = canFetchRequest(normalizedRequest)
    ? buildDepartmentDirectiveCacheKey(normalizedRequest)
    : null;
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const [state, setState] = useState<HookState>(() => ({
    cacheKey,
    data: cacheKey ? directiveCache.get(cacheKey) ?? null : null,
    error: null,
    isLoading: Boolean(cacheKey && !directiveCache.has(cacheKey)),
    isRefreshing: false,
  }));

  const load = useCallback(
    async () => {
      if (!cacheKey || normalizedRequest.scope === "none") {
        setState({
          cacheKey: null,
          data: null,
          error: null,
          isLoading: false,
          isRefreshing: false,
        });
        return null;
      }

      const cachedData = directiveCache.get(cacheKey);
      const loadingStartedAt = cachedData ? null : Date.now();

      if (cachedData) {
        setState({
          cacheKey,
          data: cachedData,
          error: null,
          isLoading: false,
          isRefreshing: true,
        });
      } else {
        setState({
          cacheKey,
          data: null,
          error: null,
          isLoading: true,
          isRefreshing: false,
        });
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      abortRef.current = controller;

      try {
        const data = await fetchDepartmentDirectives(normalizedRequest, controller.signal);

        if (loadingStartedAt !== null) {
          await waitForMinimumLoading(loadingStartedAt);
        }

        if (controller.signal.aborted || requestSeqRef.current !== requestSeq) {
          return null;
        }

        directiveCache.set(cacheKey, data);
        setState({
          cacheKey,
          data,
          error: null,
          isLoading: false,
          isRefreshing: false,
        });
        return data;
      } catch (error) {
        if (controller.signal.aborted || requestSeqRef.current !== requestSeq) {
          return null;
        }

        setState((current) => ({
          cacheKey,
          data: current.cacheKey === cacheKey ? current.data : null,
          error: error instanceof Error ? error.message : "지시사항을 불러오지 못했습니다.",
          isLoading: false,
          isRefreshing: false,
        }));
        return null;
      }
    },
    [cacheKey, normalizedRequest],
  );

  useEffect(() => {
    void load();

    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const prefetch = useCallback((nextRequest: DepartmentDirectiveRequest) => {
    const normalizedNextRequest = normalizeRequest(nextRequest);

    if (!canFetchRequest(normalizedNextRequest)) {
      return Promise.resolve(null);
    }

    const nextKey = buildDepartmentDirectiveCacheKey(normalizedNextRequest);
    const cachedData = directiveCache.get(nextKey);

    if (cachedData) {
      return Promise.resolve(cachedData);
    }

    const existingRequest = prefetchRequests.get(nextKey);

    if (existingRequest) {
      return existingRequest;
    }

    const promise = fetchDepartmentDirectives(normalizedNextRequest)
      .then((data) => {
        directiveCache.set(nextKey, data);
        return data;
      })
      .catch(() => null)
      .finally(() => {
        prefetchRequests.delete(nextKey);
      });

    prefetchRequests.set(nextKey, promise);
    return promise;
  }, []);

  const refetch = useCallback(() => load(), [load]);

  return {
    data: state.cacheKey === cacheKey ? state.data : null,
    error: state.cacheKey === cacheKey ? state.error : null,
    isLoading: state.cacheKey === cacheKey ? state.isLoading : Boolean(cacheKey),
    isRefreshing: state.cacheKey === cacheKey ? state.isRefreshing : false,
    prefetch,
    refetch,
  };
}
