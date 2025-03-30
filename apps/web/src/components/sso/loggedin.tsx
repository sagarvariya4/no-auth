"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { cn } from "@workspace/ui/lib/utils";
import { useParams } from "next/navigation";
import { useDeviceUsers } from "@/swr/hooks/devices";
import { useLoginMutation } from "@/swr/hooks/sessions";
import { device_uuid, refresh_token } from "@/lib/const/cookies";
import { FindDeviceUsersOutput } from "@/lib/trpc/schemas/v1/devices";
import { getShortName } from "@/utils/short-name";

export function SSOLoggedIn() {
  const { sso_uuid } = useParams<{ sso_uuid: string }>();

  const { data, isLoading, error } = useDeviceUsers(sso_uuid);

  const { trigger, isMutating } = useLoginMutation();

  const recentIndex = data
    ? data.reduce(
        (
          mostRecentIndex,
          currentObj,
          currentIndex,
          array: FindDeviceUsersOutput,
        ) => {
          if (currentIndex === 0) {
            return 0;
          }
          if (
            array.length > 0 &&
            currentObj.log_in_at && // Check if log_in_at is not undefined
            new Date(currentObj.log_in_at).getTime() >
              new Date(
                array.at(mostRecentIndex)?.log_in_at ?? new Date(),
              ).getTime()
          ) {
            return currentIndex;
          } else {
            return mostRecentIndex;
          }
        },
        0,
      )
    : 0;

  const handleClick = async (uuid: string) => {
    try {
      const { did, rt, redirect } = await trigger({
        sso_uuid: sso_uuid,
        user_uuid: uuid,
      });
      const redirect_url = new URL(redirect);
      redirect_url.searchParams.set(device_uuid, did);
      redirect_url.searchParams.set(refresh_token, rt);
      window.location.href = redirect_url.toString();
    } catch (error) {
      console.error("Error sending data:", error);
    }
  };

  const User = ({
    name,
    email,
    log_in_at,
    active = false,
  }: {
    name: string;
    email: string;
    log_in_at: Date;
    active?: boolean;
  }) => {
    return (
      <div className="flex w-full items-center gap-2 rounded-md text-left text-sm">
        <Avatar className="size-8">
          {/* <AvatarImage src={user.image_url} /> */}
          <AvatarFallback
            className={cn(
              "bg-accent-foreground text-accent rounded-lg",
              active && "!bg-blue-600 !text-white",
            )}
          >
            {getShortName(name)}
          </AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate text-xs">{name}</span>
          <span className="truncate font-medium">{email}</span>
          <span className="absolute right-2 bottom-1 text-[10px]">
            {new Date(log_in_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="mb-6 flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold">Continue</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Select account to continue
        </p>
      </div>
      {error ? (
        <div className="flex h-14.5 items-center justify-center">
          <p className="text-muted-foreground text-sm">
            An error occurred fetching device loggedin accounts data. Please try
            again later.
          </p>
        </div>
      ) : isMutating || isLoading || !data ? (
        <div className="flex h-14.5 items-center justify-center">
          <LoaderCircle className="animate-spin" />
        </div>
      ) : (
        <>
          <Select onValueChange={handleClick}>
            <SelectTrigger className="relative h-14.5">
              {data.length !== 0 ? (
                <User
                  name={data[recentIndex]?.name as string}
                  email={data[recentIndex]?.email as string}
                  log_in_at={data[recentIndex]?.log_in_at as Date}
                  active={true}
                />
              ) : (
                <SelectValue placeholder="Select loggedin account" />
              )}
            </SelectTrigger>
            <SelectContent className="h-58 lg:h-45">
              <SelectGroup>
                {data.length !== 0 ? (
                  data.map((user, index) => (
                    <SelectItem
                      key={index}
                      value={user.uuid}
                      className={cn(
                        recentIndex === index
                          ? "!bg-blue-600 !text-white hover:!bg-blue-700"
                          : "hover:!bg-accent",
                        "relative flex rounded-sm px-2 py-2.5",
                      )}
                    >
                      <User
                        name={user.name}
                        email={user.email}
                        log_in_at={user.log_in_at}
                      />
                    </SelectItem>
                  ))
                ) : (
                  <div className="flex h-24 items-center justify-center">
                    No loggedin accounts
                  </div>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </>
      )}
    </>
  );
}
