// import { Type } from 'class-transformer';
import {
  // IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  // ValidateNested,
} from 'class-validator';
import { Currency } from '../../schemas/agent.schema';

// export class ToolParameterDto {
//   @IsString()
//   name: string;

//   @IsString()
//   type: string;

//   @IsString()
//   description: string;

//   @IsBoolean()
//   required: boolean;
// }

export class DestinationConfigDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  recipient?: string;
}

// export class ToolDto {
//   @IsOptional()
//   @IsString()
//   id?: string;

//   @IsString()
//   name: string;

//   @IsString()
//   description: string;

//   @IsOptional()
//   @ValidateNested({ each: true })
//   @Type(() => ToolParameterDto)
//   parameters?: ToolParameterDto[];

//   @IsOptional()
//   @IsString()
//   returns?: string;

//   @IsOptional()
//   @IsIn(['custom', 'api_webhook', 'sms', 'whatsapp', 'email'])
//   kind?: ToolKind;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => DestinationConfigDto)
//   destinationConfig?: DestinationConfigDto;
// }

// export class NodePositionDto {
//   @IsNumber()
//   x: number;

//   @IsNumber()
//   y: number;
// }

// export class AgentNodeDto {
//   @IsOptional()
//   @IsString()
//   id?: string;

//   @IsString()
//   name: string;

//   @IsOptional()
//   @IsString({ each: true })
//   tools?: string[];

//   @IsString()
//   prompt: string;

//   @IsOptional()
//   @IsString()
//   nextNode?: string;

//   @IsOptional()
//   @IsString()
//   previousNode?: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => NodePositionDto)
//   position?: NodePositionDto;
// }

export class ReferralBonusDto {
  @IsNumber()
  amount: number;

  @IsIn(['USD', 'INR', 'AED', 'THB', 'GBP', 'EUR'])
  currency: Currency;
}

export class McpServerDto {
  @IsString()
  @MinLength(1)
  server_name: string;

  @IsString()
  @MinLength(1)
  url: string;

  @IsString()
  @MinLength(1)
  api_key: string;
}
