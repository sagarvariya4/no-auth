import { Controller, Get, Logger, Param, Req, Res } from "@nestjs/common";
import { zodToOpenAPI } from "nestjs-zod";

import {
  FindDeviceUsersOutput,
  findDeviceUsersOutput,
  insertOneDeviceOutput,
  InsertOneDeviceOutput,
} from "@/lib/trpc/schemas/v1/devices";
import { ApiParam, ApiResponse } from "@nestjs/swagger";
import { DevicesV1Service } from "@/app/devices/services/devices.v1.service";
import { FastifyReply, FastifyRequest } from "fastify";
import { BasicService } from "@/app/basic/basic.service";
import { AccessTokenService } from "@/app/sessions/jwt/access-token.service";
import { RefreshTokenService } from "@/app/sessions/jwt/refresh-token.service";
import { DeviceDocument } from "@/app/devices/entities/device.entity";
import {
  device_uuid as device_uuid_key,
  refresh_token as refresh_token_key,
} from "@/lib/const/cookies";

@Controller({
  path: "devices",
  version: "1",
})
export class DevicesV1Controller {
  private logger: Logger = new Logger(DevicesV1Controller.name);

  constructor(
    private readonly devicesService: DevicesV1Service,
    private readonly basicService: BasicService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {
    try {
      this.logger.log({
        action: "Construct",
      });
    } catch (error) {
      this.logger.error({
        action: "Construct",
        error: error,
      });

      throw new Error("Constructor Failure!");
    }
  }

  @Get("users/:sso_uuid")
  @ApiResponse({
    schema: zodToOpenAPI(findDeviceUsersOutput),
  })
  @ApiParam({
    name: "sso_uuid",
    type: "string",
  })
  async findDeviceUsers(
    @Req() req: FastifyRequest,
    @Param("sso_uuid") sso_uuid: string,
  ): Promise<FindDeviceUsersOutput> {
    try {
      this.logger.debug({
        action: "Entry",
        method: this.findDeviceUsers.name,
        metadata: {},
      });

      const device_uuid = req.cookies[device_uuid_key];
      const refresh_token = req.cookies[refresh_token_key];
      if (!device_uuid || !refresh_token) {
        return findDeviceUsersOutput.parse([]);
      }

      const token = await this.refreshTokenService.verifyAsync(refresh_token);

      const [device] = await this.basicService.find({
        schema: "Device",
        filter: {
          uuid: device_uuid,
        },
        select: [],
        populate: [],
      });

      if (device?.sessions) {
        const sso_users_obj = device.sessions?.[sso_uuid];

        if (sso_users_obj) {
          const sso_users = sso_users_obj.users;
          const user_uuids = Object.keys(sso_users);

          const userDocuments = await this.basicService.find({
            schema: "User",
            filter: {
              uuid: { $in: user_uuids },
            },
            select: [],
            populate: [],
          });

          const users = userDocuments.map((userDocument) => ({
            name: userDocument.name,
            email: userDocument.email,
            uuid: userDocument.uuid,
            active: userDocument.uuid === token.act,
            ...sso_users[userDocument.uuid],
          }));

          return findDeviceUsersOutput.parse(users);
        }
      }

      this.logger.log({
        action: "Exit",
        method: this.findDeviceUsers.name,
        metadata: {},
      });

      return findDeviceUsersOutput.parse([]);
    } catch (error) {
      this.logger.error({
        action: "Exit",
        method: this.findDeviceUsers.name,
        error: error,
      });

      throw error;
    }
  }

  @Get("uuid")
  @ApiResponse({
    schema: zodToOpenAPI(insertOneDeviceOutput),
  })
  async upsertDevice(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<InsertOneDeviceOutput> {
    try {
      this.logger.debug({
        action: "Entry",
        method: this.upsertDevice.name,
        metadata: {},
      });

      const device_uuid = req.cookies[device_uuid_key];
      let device: DeviceDocument;
      if (!device_uuid) {
        device = await this.basicService.insertOne({
          schema: "Device",
          doc: {},
        });
      } else {
        [device] = await this.basicService.find({
          schema: "Device",
          filter: {
            uuid: device_uuid,
          },
          populate: [],
          select: [],
        });
      }

      res.setCookie(device_uuid_key, device.uuid, {
        httpOnly: true,
        priority: "high",
        secure: true,
        sameSite: true,
        path: "/",
      });

      this.logger.log({
        action: "Exit",
        method: this.upsertDevice.name,
        metadata: {},
      });

      return insertOneDeviceOutput.parse(device);
    } catch (error) {
      this.logger.error({
        action: "Exit",
        method: this.upsertDevice.name,
        error: error,
      });

      throw error;
    }
  }
}
