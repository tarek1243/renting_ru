import { Controller, Headers, Param, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Public } from "../../common/decorators";
import { PaymentsService } from "./payments.service";

@ApiTags("Payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post("webhooks/:gateway")
  @ApiOperation({
    summary: "Inbound PSP webhook (stripe | regional)",
    description: "Signature-verified per gateway. Marks payments captured/failed and triggers notifications.",
  })
  webhook(
    @Param("gateway") gateway: string,
    @Req() req: Request,
    @Headers("stripe-signature") stripeSig?: string,
  ) {
    const raw: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.payments.handleGatewayWebhook(gateway, raw, stripeSig);
  }
}
