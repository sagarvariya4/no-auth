import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { SessionsV1Service } from "@/app/sessions/services/sessions.v1.service";
import { AccessTokenService } from "../jwt/access-token.service";
import { RefreshTokenService } from "../jwt/refresh-token.service";
import { ApiBody, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { zodToOpenAPI } from "nestjs-zod";
import {
  AccessToken,
  AccessTokenCreate,
  accessTokenCreate,
  RefreshToken,
  refreshTokenCreate,
  RefreshTokenCreate,
  signedRefreshToken,
} from "@/lib/trpc/schemas/v1/sessions";
import { BasicService } from "@/app/basic/basic.service";
import { OrganizationDocument } from "@/app/organizations/entities/organization.entity";
import { randomUUID } from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { Sessions } from "@/lib/trpc/schemas/v1/devices";
import { useUser } from "@/lib/trpc/schemas/v1/users";
import {
  device_uuid as device_uuid_key,
  refresh_token as refresh_token_key,
} from "@/lib/const/cookies";

@Controller({
  path: "sessions",
  version: "1",
})
export class SessionsV1Controller {
  private logger: Logger = new Logger(SessionsV1Controller.name);

  constructor(
    private readonly sessionsService: SessionsV1Service,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly basicService: BasicService,
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

  @Get("users")
  @ApiResponse({
    status: 200,
    schema: zodToOpenAPI(useUser),
  })
  async useUser(@Req() req: FastifyRequest) {
    try {
      this.logger.debug({
        action: "Entry",
        method: this.useUser.name,
        metadata: {},
      });

      const device_uuid = req.cookies[device_uuid_key];
      const refresh_token = req.cookies[refresh_token_key];
      if (!device_uuid || !refresh_token) {
        throw new Error("No device_uuid or refresh_token");
      }

      const payload = await this.refreshTokenService.verifyAsync(refresh_token);

      const [user] = await this.basicService.find({
        schema: "User",
        filter: {
          uuid: payload.act,
        },
        populate: [],
        select: [],
      });

      this.logger.log({
        action: "Exit",
        method: this.useUser.name,
        metadata: {},
      });

      return useUser.parse(user);
    } catch (error) {
      this.logger.error({
        action: "Exit",
        method: this.useUser.name,
        error: error,
      });

      throw error;
    }
  }

  @Post("sign/access")
  @ApiBody({
    schema: zodToOpenAPI(accessTokenCreate),
  })
  async signAsyncAccess(@Body() tokenCreateData: AccessTokenCreate) {
    try {
      this.logger.debug({
        action: "Entry",
        method: this.signAsyncAccess.name,
        metadata: {
          tokenCreateData,
        },
      });

      // create access token
      const token = await this.accessTokenService.signAsync(
        tokenCreateData as any,
      );

      this.logger.log({
        action: "Exit",
        method: this.signAsyncAccess.name,
        metadata: {},
      });

      return token;
    } catch (error) {
      this.logger.error({
        action: "Exit",
        method: this.signAsyncAccess.name,
        error: error,
        tokenCreateData,
      });

      throw error;
    }
  }

  @Get("verify/access")
  @ApiQuery({
    name: "token",
    required: true,
  })
  async verifyAsyncAccess(@Query("token") token: AccessToken) {
    try {
      this.logger.debug({
        action: "Entry",
        method: this.verifyAsyncAccess.name,
        metadata: {
          token,
        },
      });

      // verify access token
      const payload = await this.accessTokenService.verifyAsync(token);

      this.logger.log({
        action: "Exit",
        method: this.verifyAsyncAccess.name,
        metadata: {},
      });

      return payload;
    } catch (error) {
      this.logger.error({
        action: "Exit",
        method: this.verifyAsyncAccess.name,
        error: error,
        token,
      });

      throw error;
    }
  }

  @Get("decode/access")
  @ApiQuery({
    name: "token",
    required: true,
  })
  async decodeAccess(@Query("token") token: AccessToken) {
    try {
      this.logger.debug({
        action: "Entry",
        method: this.decodeAccess.name,
        metadata: {
          token,
        },
      });

      // decode access token
      const payload = this.accessTokenService.decode(token);

      this.logger.log({
        action: "Exit",
        method: this.decodeAccess.name,
        metadata: {},
      });

      return payload;
    } catch (error) {
      this.logger.error({
        action: "Exit",
        method: this.decodeAccess.name,
        error: error,
        token,
      });

      throw error;
    }
  }

  @Post("sign/refresh")
  @ApiBody({
    schema: zodToOpenAPI(refreshTokenCreate),
  })
  @ApiResponse({
    status: 201,
    schema: zodToOpenAPI(signedRefreshToken),
  })
  async signAsyncRefresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() tokenCreateData: RefreshTokenCreate,
  ) {
    try {
      this.logger.debug({
        action: "Entry",
        method: this.signAsyncRefresh.name,
        metadata: {
          tokenCreateData,
        },
      });

      const device_uuid = req.cookies[device_uuid_key];
      if (!device_uuid) {
        throw new Error("No device_uuid");
      }

      let user_uuids: string[];
      let session_uuid: string;
      const refresh_token = req.cookies[refresh_token_key];

      if (refresh_token) {
        const payload = await this.verifyAsyncRefresh(refresh_token);

        session_uuid = payload.jti;
        user_uuids = [...new Set([...payload.sub, tokenCreateData.user_uuid])];
      } else {
        session_uuid = randomUUID();
        user_uuids = [tokenCreateData.user_uuid];
      }

      const [sso] = await this.basicService.find({
        schema: "SSO",
        filter: {
          uuid: tokenCreateData.sso_uuid,
        },
        populate: ["organization_id"],
        select: [],
      });
      const organization_uuid = (
        sso.organization_id as unknown as OrganizationDocument
      ).uuid;

      const curr = new Date();
      const token = await this.refreshTokenService.signAsync({
        iss: "No Auth",
        sub: user_uuids,
        did: device_uuid,
        jti: session_uuid,
        aud: organization_uuid,
        sso: tokenCreateData.sso_uuid,
        act: tokenCreateData.user_uuid,
        iat: Math.round(curr.getTime() / 1000),
      });

      const [device] = await this.basicService.find({
        schema: "Device",
        filter: {
          uuid: device_uuid,
        },
        select: [],
        populate: [],
      });

      let sessions: Sessions;
      if (device?.sessions) {
        sessions = {
          ...device.sessions,
          [tokenCreateData.sso_uuid]: {
            ...device.sessions[tokenCreateData.sso_uuid],
            jti: session_uuid,
            users: {
              ...device.sessions?.[tokenCreateData.sso_uuid]?.users,
              [tokenCreateData.user_uuid]: {
                ...device.sessions?.[tokenCreateData.sso_uuid]?.users[
                  tokenCreateData.user_uuid
                ],
                log_in_at: curr,
              },
            },
          },
        };
      } else {
        sessions = {
          [tokenCreateData.sso_uuid]: {
            jti: session_uuid,
            users: {
              [tokenCreateData.user_uuid]: {
                log_in_at: curr,
              },
            },
          },
        };
      }

      await this.basicService.findOneAndUpdate({
        schema: "Device",
        filter: {
          uuid: device_uuid,
        },
        update: {
          sessions: sessions,
        },
        select: [],
        populate: [],
      });

      res.setCookie(device_uuid_key, device_uuid, {
        httpOnly: true,
        priority: "high",
        secure: true,
        sameSite: true,
        path: "/",
      });

      res.setCookie(refresh_token_key, token, {
        httpOnly: true,
        priority: "high",
        secure: true,
        sameSite: true,
        path: "/",
      });

      const data = {
        rt: token,
        did: device_uuid,
        redirect: sso.redirect_url,
      };

      this.logger.log({
        action: "Exit",
        method: this.signAsyncRefresh.name,
        metadata: {
          data,
        },
      });

      return signedRefreshToken.parse(data);
    } catch (error) {
      this.logger.error({
        action: "Exit",
        method: this.signAsyncRefresh.name,
        error: error,
        tokenCreateData,
      });

      throw error;
    }
  }

  @Get("verify/refresh")
  @ApiQuery({
    name: "token",
    required: true,
  })
  async verifyAsyncRefresh(@Query("token") token: RefreshToken) {
    try {
      this.logger.debug({
        action: "Entry",
        method: this.verifyAsyncRefresh.name,
        metadata: {
          token,
        },
      });

      // verify refresh token
      const payload = await this.refreshTokenService.verifyAsync(token);

      this.logger.log({
        action: "Exit",
        method: this.verifyAsyncRefresh.name,
        metadata: {},
      });

      return payload;
    } catch (error) {
      this.logger.error({
        action: "Exit",
        method: this.verifyAsyncRefresh.name,
        error: error,
        token,
      });

      throw error;
    }
  }
  @Get("decode/refresh")
  @ApiQuery({
    name: "token",
    required: true,
  })
  async decodeRefresh(@Query("token") token: RefreshToken) {
    try {
      this.logger.debug({
        action: "Entry",
        method: this.decodeRefresh.name,
        metadata: {
          token,
        },
      });

      // decode refresh token
      const payload = this.refreshTokenService.decode(token);

      this.logger.log({
        action: "Exit",
        method: this.decodeRefresh.name,
        metadata: {},
      });

      return payload;
    } catch (error) {
      this.logger.error({
        action: "Exit",
        method: this.decodeRefresh.name,
        error: error,
        token,
      });

      throw error;
    }
  }
}
