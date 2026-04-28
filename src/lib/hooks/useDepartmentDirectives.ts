"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildDepartmentDirectiveCacheKey,
  type DirectiveStatusValue,
} from "@/lib/constants/status-labels";

export type DepartmentDirectiveItem = {
  created_at: string;
  directive_no: string;
  id: string;
  is_urgent: boolean;
  status: DirectiveStatusValue;
  title: string;
  updated_at: string | null;
  urgent_level: string | null;
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

function normalizeRequest(request: DepartmentDirectiveRequest) {
  return {
    departmentId: request.departmentId ?? "",
    limit: request.limit ?? 50,
    page: request.page ?? 1,
    status: request.status ?? null,
    urgent: request.urgent === true,
  };
}

function buildRequestUrl(request: ReturnType<typeof normalizeRequest>) {
  const params = new URLSearchParams({
    departmentId: request.departmentId,
    limit: String(request.limit),
    page: String(request.page),
  });

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
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  return readDirectiveResponse(response);
}

export function useDepartmentDirectives(request: DepartmentDirectiveRequest) {
  const normalizedRequest = useMemo(
    () => ({
      departmentId: request.departmentId ?? "",
      limit: request.limit ?? 50,
      page: request.page ?? 1,
      status: request.status ?? null,
      urgent: request.urgent === true,
    }),
    [request.departmentId, request.limit, request.page, request.status, request.urgent],
  );
  const cacheKey = normalizedRequest.departmentId
    ? buildDepartmentDirectiveCacheKey(normalizedRequest)
    : null;
  const abortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<HookState>(() => ({
    cacheKey,
    data: cacheKey ? directiveCache.get(cacheKey) ?? null : null,
    error: null,
    isLoading: Boolean(cacheKey && !directiveCache.has(cacheKey)),
    isRefreshing: false,
  }));

  const load = useCallback(
    async (options?: { force?: boolean }) => {
      if (!cacheKey || !normalizedRequest.departmentId) {
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

      if (cachedData && !options?.force) {
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
      abortRef.current = controller;

      try {
        const data = await fetchDepartmentDirectives(normalizedRequest, controller.signal);
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
        if (controller.signal.aborted) {
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

    if (!normalizedNextRequest.departmentId) {
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

  const refetch = useCallback(() => load({ force: true }), [load]);

  return {
    data: state.cacheKey === cacheKey ? state.data : null,
    error: state.cacheKey === cacheKey ? state.error : null,
    isLoading: state.cacheKey === cacheKey ? state.isLoading : Boolean(cacheKey),
    isRefreshing: state.cacheKey === cacheKey ? state.isRefreshing : false,
    prefetch,
    refetch,
  };
}
