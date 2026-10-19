import { Type } from 'class-transformer';
import {
  // IsArray,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

import { AgentStatus } from '../../schemas/agent.schema';
import { McpServerDto, ReferralBonusDto } from './agent-parts.dto';

export class CreateAgentDto {
  @IsString()
  agent_name: string;

  @IsOptional()
  @IsBoolean()
  enable_voice?: boolean;

  @IsString()
  @IsNotEmpty()
  country_code: string;

  @IsString()
  @IsOptional()
  @IsPhoneNumber()
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsOptional()
  @IsIn(['draft'])
  status?: AgentStatus;

  // @IsOptional()
  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => AgentNodeDto)
  // nodes?: AgentNodeDto[];

  // @IsOptional()
  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => ToolDto)
  // tools?: ToolDto[];

  @IsNotEmpty()
  @IsString()
  base_template_id: string;

  @IsOptional()
  @IsString()
  greeting?: string;

  @IsOptional()
  @IsString()
  behavior_prompt?: string;

  @IsOptional()
  @IsString()
  behavior_notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReferralBonusDto)
  referral_bonus?: ReferralBonusDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledge_base_ids?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => McpServerDto)
  mcp_servers?: McpServerDto[];
}
