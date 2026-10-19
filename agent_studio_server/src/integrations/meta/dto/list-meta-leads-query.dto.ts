import { IsNotEmpty, IsString } from 'class-validator';
import { ListLeadsQueryDto } from '../../../common/dto/list-leads-query.dto';

export class ListMetaLeadsQueryDto extends ListLeadsQueryDto {
  /** Only leads from Pages linked to this agent are returned. */
  @IsString()
  @IsNotEmpty()
  agentId: string;
}
