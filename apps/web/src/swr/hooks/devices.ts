"use client";

import useSWR from "swr";

import {
  FindDeviceUsersOutput,
  InsertOneDeviceOutput,
} from "@/lib/trpc/schemas/v1/devices";
import { fetcher } from "@/swr/server";
import { env } from "@/env/client/env.schema";

export function useDeviceUsers(sso_uuid: string) {
  return useSWR<FindDeviceUsersOutput>(
    `${env.APP_BASE_URL}/api/v1/devices/users/${sso_uuid}`,
    (url) =>
      fetcher(url, {
        method: "GET",
      }),
    {},
  );
}

export function useDevice() {
  return useSWR<InsertOneDeviceOutput>(
    `${env.APP_BASE_URL}/api/v1/devices/uuid`,
    (url) =>
      fetcher(url, {
        method: "GET",
      }),
    {},
  );
}
