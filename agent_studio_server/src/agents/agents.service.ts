import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { ListLeadsQueryDto } from '../common/dto/list-leads-query.dto';
import { assertSameCompany } from '../common/utils/company-scope.util';
import { isDuplicateKeyError } from '../common/utils/mongo-error.util';
import { TemplatesService } from '../templates/templates.service';
import { AgentHistoriesRepository } from '../repos/agent-histories.repository';
import { AgentLeadsRepository } from '../repos/agent-leads.repository';
import { AgentsRepository } from '../repos/agents.repository';
import { KnowledgeBasesRepository } from '../repos/knowledge-bases.repository';
import { LiveAgentsRepository } from '../repos/live-agents.repository';
import {
  ProductEnquiriesRepository,
  ProductStatsRow,
} from '../repos/product-enquiries.repository';
import { CreateAgentDto } from './dto/create-agent.dto';
import { GoLiveDto } from './dto/go-live.dto';
import { ListProductStatsQueryDto } from './dto/list-product-stats-query.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { Agent, AgentDocument } from '../schemas/agent.schema';
import { AgentLead } from '../schemas/agent-leads.schema';
import { LiveAgent, LiveAgentDocument } from '../schemas/live-agent.schema';

const MAX_CLONE_RETRIES = 5;
const DEFAULT_PRODUCT_STATS_RANGE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCloneSuffix(name: string): string {
  const match = /^(.*) Clone \d+$/.exec(name);
  return match ? match[1] : name;
}

function computePreviewHash(agent: {
  greeting?: string;
  behavior_prompt?: string;
  behavior_notes?: string;
}): string {
  const payload = JSON.stringify({
    greeting: agent.greeting ?? '',
    behavior_prompt: agent.behavior_prompt ?? '',
    behavior_notes: agent.behavior_notes ?? '',
  });
  return createHash('sha256').update(payload).digest('hex');
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly liveAgentsRepository: LiveAgentsRepository,
    private readonly agentHistoriesRepository: AgentHistoriesRepository,
    private readonly knowledgeBasesRepository: KnowledgeBasesRepository,
    private readonly agentLeadsRepository: AgentLeadsRepository,
    private readonly productEnquiriesRepository: ProductEnquiriesRepository,
    private readonly templatesService: TemplatesService,
  ) { }

  async findAll(companyId: string | null): Promise<Agent[]> {
    return this.agentsRepository.filterAll(companyId);
  }

  findAllLive(companyId: string | null): Promise<LiveAgent[]> {
    return this.liveAgentsRepository.filterAll(companyId);
  }

  /**
   * `companyId` is optional: some internal callers (monitoring, reporting)
   * don't yet carry a requester company context and look up agents across
   * companies. Pass it whenever the caller has an authenticated requester.
   */
  async findById(
    id: string,
    companyId?: string | null,
  ): Promise<AgentDocument> {
    const agent = await this.agentsRepository.filterById(id);
    if (!agent) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    if (companyId !== undefined) {
      assertSameCompany(companyId, agent.companyId, `Agent ${id} not found`);
    }
    return agent;
  }

  async findByAgentId(
    agentId: string,
    companyId?: string | null,
  ): Promise<AgentDocument> {
    const agent = await this.agentsRepository.filterByAgentId(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent with agent_id ${agentId} not found`);
    }
    if (companyId !== undefined) {
      assertSameCompany(
        companyId,
        agent.companyId,
        `Agent with agent_id ${agentId} not found`,
      );
    }
    return agent;
  }

  async create(
    dto: CreateAgentDto,
    companyId: string | null,
  ): Promise<Agent> {
    const prepared = await this.applyTemplateDefaultsAndBonusRule(dto);
    const knowledgeBaseIds = await this.resolveKnowledgeBaseIds(
      prepared.knowledge_base_ids,
    );
    return this.agentsRepository.create({
      ...prepared,
      companyId,
      language: dto.language,
      agent_id: randomUUID(),
      agent_name: prepared.agent_name,
      country_code: (prepared.country_code ?? dto.country_code).trim(),
      phone_number: prepared.phone_number?.trim() || null,
      enable_voice: prepared.enable_voice ?? true,
      status: 'draft',
      base_template_id: prepared.base_template_id,
      greeting: prepared.greeting,
      behavior_prompt: prepared.behavior_prompt,
      behavior_notes: prepared.behavior_notes,
      referral_bonus: prepared.referral_bonus,
      knowledge_base_ids: knowledgeBaseIds,
      mcp_servers: prepared.mcp_servers ?? [],
      preview_hash: null,
      current_stage_version: 0,
      staged_at: null,
      live_at: null,
      nodes: [],
    });
  }

  async update(
    id: string,
    dto: UpdateAgentDto,
    companyId: string | null,
  ): Promise<Agent> {
    const agent = await this.findById(id, companyId);
    const prepared = await this.applyTemplateDefaultsAndBonusRule(
      dto,
      agent.base_template_id,
    );

    const patch: Record<string, unknown> = { ...prepared };
    delete patch.agent_id;
    delete patch.status;
    if (prepared.country_code !== undefined) {
      patch.country_code = prepared.country_code.trim();
    }
    if (prepared.phone_number !== undefined) {
      patch.phone_number = prepared.phone_number.trim() || null;
    }
    if (prepared.knowledge_base_ids !== undefined) {
      patch.knowledge_base_ids = await this.resolveKnowledgeBaseIds(
        prepared.knowledge_base_ids,
      );
    }
    if (prepared.mcp_servers !== undefined) {
      patch.mcp_servers = prepared.mcp_servers;
    }
    if (Object.keys(patch).length === 0) {
      return agent;
    }

    if (agent.status !== 'draft') {
      await this.archiveCurrentStageVersion(agent);
      patch.status = 'draft';
      patch.preview_hash = null;
      patch.staged_at = null;
      patch.live_at = null;
    }

    const updated = await this.agentsRepository.update(id, patch);
    if (!updated) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return updated;
  }

  async delete(id: string, companyId: string | null): Promise<void> {
    await this.findById(id, companyId);
    const result = await this.agentsRepository.deleteById(id);
    if (!result) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
  }

  async clone(id: string, companyId: string | null): Promise<Agent> {
    const source = await this.findById(id, companyId);
    const baseName = stripCloneSuffix(source.agent_name);
    const baseNameKey = baseName.toLowerCase();
    const cloneRegex = new RegExp(`^${escapeRegExp(baseName)} Clone (\\d+)$`);

    for (let attempt = 0; attempt < MAX_CLONE_RETRIES; attempt++) {
      const candidates =
        await this.agentsRepository.filterByNameRegex(cloneRegex);
      const maxN = candidates.reduce((max, candidate) => {
        const match = cloneRegex.exec(candidate.agent_name);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      const nextN = maxN + 1;

      try {
        return await this.agentsRepository.create({
          companyId,
          agent_name: `${baseName} Clone ${nextN}`,
          agent_id: randomUUID(),
          country_code: source.country_code,
          phone_number: source.phone_number ?? null,
          enable_voice: source.enable_voice,
          status: 'draft',
          nodes: [],
          base_template_id: source.base_template_id,
          greeting: source.greeting,
          behavior_prompt: source.behavior_prompt,
          behavior_notes: source.behavior_notes,
          referral_bonus: source.referral_bonus,
          knowledge_base_ids: source.knowledge_base_ids ?? [],
          mcp_servers: source.mcp_servers ?? [],
          preview_hash: null,
          current_stage_version: 0,
          staged_at: null,
          live_at: null,
          clone_base_name: baseNameKey,
          clone_number: nextN,
        });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      'Could not compute a unique clone name after several attempts, please retry',
    );
  }

  async preview(
    id: string,
    companyId: string | null,
  ): Promise<{ transcript: string }> {
    const agent = await this.findById(id, companyId);
    if (agent.status !== 'staged') {
      throw new ConflictException(
        `Only staged agents can be previewed for go-live validation. Current status: ${agent.status}`,
      );
    }
    const previewHash = computePreviewHash(agent);
    const updated = await this.agentsRepository.update(id, {
      preview_hash: previewHash,
    });
    if (!updated) {
      throw new NotFoundException(`Agent ${id} not found`);
    }

    const greeting = updated.greeting ?? 'Hello, how can I help you today?';
    const promptSummary = updated.behavior_prompt
      ? ` The agent proceeds according to its configured behavior: "${updated.behavior_prompt}"`
      : '';
    const transcript = `Agent: ${greeting}\nCaller: Hi, I had a question.\nAgent: Sure, happy to help.${promptSummary}`;

    return { transcript };
  }

  async moveToStage(id: string, companyId: string | null): Promise<Agent> {
    const agent = await this.findById(id, companyId);
    if (agent.status !== 'draft') {
      throw new ConflictException(
        `Only draft agents can move to stage. Current status: ${agent.status}`,
      );
    }

    const stagedAt = new Date();
    const updated = await this.agentsRepository.update(id, {
      status: 'staged',
      current_stage_version: agent.current_stage_version + 1,
      staged_at: stagedAt,
      preview_hash: null,
    });
    if (!updated) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return updated;
  }

  async moveToLive(
    id: string,
    dto: GoLiveDto,
    companyId: string | null,
  ): Promise<Agent> {
    const agent = await this.findById(id, companyId);
    if (agent.status !== 'staged') {
      throw new ConflictException(
        `Only staged agents can move to live. Current status: ${agent.status}`,
      );
    }

    const currentHash = computePreviewHash(agent);
    if (!agent.preview_hash || agent.preview_hash !== currentHash) {
      throw new ConflictException(
        'Agent configuration has changed since the last preview. Preview the staged agent again before going live',
      );
    }

    const productionPhoneNumber = dto.phone_number.trim();
    const publishedAt = new Date();
    const existingLive = await this.liveAgentsRepository.filterByAgentId(
      agent.agent_id,
    );
    const previousHistoryId = existingLive
      ? await this.resolvePreviousLiveHistoryId(existingLive)
      : undefined;

    await this.archiveCurrentStageVersion(agent, 'live', publishedAt);
    await this.liveAgentsRepository.publishByAgentId(
      agent.agent_id,
      {
        companyId: agent.companyId,
        agent_id: agent.agent_id,
        source_agent_document_id: String(agent._id),
        agent_name: agent.agent_name,
        country_code: agent.country_code,
        phone_number: productionPhoneNumber,
        enable_voice: agent.enable_voice,
        status: 'live',
        nodes: agent.nodes ?? [],
        base_template_id: agent.base_template_id,
        greeting: agent.greeting,
        behavior_prompt: agent.behavior_prompt,
        behavior_notes: agent.behavior_notes,
        referral_bonus: agent.referral_bonus,
        knowledge_base_ids: agent.knowledge_base_ids ?? [],
        mcp_servers: agent.mcp_servers ?? [],
        stage_version: agent.current_stage_version,
        published_at: publishedAt,
      },
      previousHistoryId,
    );

    const updated = await this.agentsRepository.update(id, {
      status: 'live',
      live_at: publishedAt,
    });
    if (!updated) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return updated;
  }

  async disable(id: string, companyId: string | null): Promise<Agent> {
    const agent = await this.findById(id, companyId);
    if (agent.status !== 'live') {
      throw new ConflictException(
        `Only live agents can be disabled. Current status: ${agent.status}`,
      );
    }

    const updated = await this.agentsRepository.update(id, {
      status: 'disabled',
    });
    if (!updated) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return updated;
  }

  async enable(id: string, companyId: string | null): Promise<Agent> {
    const agent = await this.findById(id, companyId);
    if (agent.status !== 'disabled') {
      throw new ConflictException(
        `Only disabled agents can be enabled. Current status: ${agent.status}`,
      );
    }

    const updated = await this.agentsRepository.update(id, {
      status: 'live',
    });
    if (!updated) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return updated;
  }

  async listHistory(id: string, companyId: string | null) {
    const agent = await this.findById(id, companyId);
    return this.agentHistoriesRepository.filterBySourceAgentId(agent.agent_id);
  }

  async listHistoryByAgentId(agentId: string, companyId: string | null) {
    const agent = await this.findByAgentId(agentId, companyId);
    return this.agentHistoriesRepository.filterBySourceAgentId(agent.agent_id);
  }

  /**
   * Lists leads attributed to this agent (paginated, with optional name/phone
   * search and a date range) — independent of the Meta leads pipeline; see
   * `agent_leads` collection.
   */
  async listLeads(
    id: string,
    companyId: string | null,
    query: ListLeadsQueryDto,
  ): Promise<{
    leads: AgentLead[];
    total: number;
    page: number;
    limit: number;
  }> {
    const agent = await this.findById(id, companyId);
    if (!companyId) {
      throw new BadRequestException('User is not associated with a company');
    }
    const { items, total } = await this.agentLeadsRepository.findByAgentId(
      companyId,
      String(agent._id),
      query,
    );
    return {
      leads: items,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  /**
   * Per-product enquiry counts for this agent's `sales_properties` over a date
   * range (default: last 14 days) — every product is listed, including ones
   * with no enquiries. Preview-channel traffic is excluded; see
   * `product_enquiries` collection.
   */
  async productStats(
    id: string,
    companyId: string | null,
    query: ListProductStatsQueryDto,
  ): Promise<{
    items: ProductStatsRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const agent = await this.findById(id, companyId);
    const to = query.toDate ? new Date(query.toDate) : new Date();
    const from = query.fromDate
      ? new Date(query.fromDate)
      : new Date(to.getTime() - DEFAULT_PRODUCT_STATS_RANGE_DAYS * DAY_MS);
    if (from > to) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } =
      await this.productEnquiriesRepository.aggregateStatsForAgent({
        agentId: String(agent._id),
        from,
        to,
        search: query.search,
        sort: query.sort ?? 'enquiries',
        order: query.order ?? 'desc',
        page,
        limit,
      });
    return { items, total, page, limit };
  }

  /**
   * Resolves the agent_histories id for the live version about to be replaced.
   * Prefers an existing history row for that stage_version; otherwise archives
   * a snapshot from the current live-agent document.
   */
  private async resolvePreviousLiveHistoryId(
    existingLive: LiveAgentDocument,
  ): Promise<string | undefined> {
    const existingHistory =
      await this.agentHistoriesRepository.filterBySourceAgentIdAndStageVersion(
        existingLive.agent_id,
        existingLive.stage_version,
      );
    if (existingHistory) {
      return String(existingHistory._id);
    }

    const archived = await this.agentHistoriesRepository.create({
      companyId: existingLive.companyId,
      source_agent_id: existingLive.agent_id,
      source_agent_document_id: existingLive.source_agent_document_id,
      stage_version: existingLive.stage_version,
      snapshot_status: 'live',
      agent_name: existingLive.agent_name,
      country_code: existingLive.country_code,
      phone_number: existingLive.phone_number ?? null,
      enable_voice: existingLive.enable_voice,
      nodes: existingLive.nodes ?? [],
      base_template_id: existingLive.base_template_id,
      greeting: existingLive.greeting,
      behavior_prompt: existingLive.behavior_prompt,
      behavior_notes: existingLive.behavior_notes,
      referral_bonus: existingLive.referral_bonus,
      knowledge_base_ids: existingLive.knowledge_base_ids ?? [],
      mcp_servers: existingLive.mcp_servers ?? [],
      staged_at: null,
      live_at: existingLive.published_at ?? null,
      archived_at: new Date(),
    });
    return String(archived._id);
  }

  private async archiveCurrentStageVersion(
    agent: AgentDocument,
    snapshotStatus?: 'staged' | 'live',
    liveAtOverride?: Date,
  ): Promise<void> {
    if (
      (agent.status !== 'staged' &&
        agent.status !== 'live' &&
        agent.status !== 'disabled') ||
      agent.current_stage_version <= 0
    ) {
      return;
    }

    const alreadyArchived =
      await this.agentHistoriesRepository.existsBySourceAgentIdAndStageVersion(
        agent.agent_id,
        agent.current_stage_version,
      );
    if (alreadyArchived) {
      return;
    }

    const resolvedSnapshotStatus =
      snapshotStatus ?? (agent.status === 'live' ? 'live' : 'staged');

    await this.agentHistoriesRepository.create({
      companyId: agent.companyId,
      source_agent_id: agent.agent_id,
      source_agent_document_id: String(agent._id),
      stage_version: agent.current_stage_version,
      snapshot_status: resolvedSnapshotStatus,
      agent_name: agent.agent_name,
      country_code: agent.country_code,
      phone_number: agent.phone_number ?? null,
      enable_voice: agent.enable_voice,
      nodes: agent.nodes ?? [],
      base_template_id: agent.base_template_id,
      greeting: agent.greeting,
      behavior_prompt: agent.behavior_prompt,
      behavior_notes: agent.behavior_notes,
      referral_bonus: agent.referral_bonus,
      knowledge_base_ids: agent.knowledge_base_ids ?? [],
      mcp_servers: agent.mcp_servers ?? [],
      staged_at: agent.staged_at ?? null,
      live_at: liveAtOverride ?? agent.live_at ?? null,
      archived_at: new Date(),
    });
  }

  /**
   * Defense-in-depth mirror of the frontend's client-side substitution
   * (backend-openspec/specs/agents/spec.md, "Fallback-to-template-default").
   * Also enforces the referral_bonus eligibility rule.
   */
  private async applyTemplateDefaultsAndBonusRule(
    dto: CreateAgentDto | UpdateAgentDto,
    existingTemplateId?: string,
  ): Promise<CreateAgentDto | UpdateAgentDto> {
    const result = { ...dto };
    const templateId = result.base_template_id ?? existingTemplateId;

    if (templateId) {
      const template = await this.templatesService
        .findById(templateId)
        .catch(() => null);
      if (template) {
        if (
          result.agent_name !== undefined &&
          result.agent_name.trim() === ''
        ) {
          result.agent_name = template.name;
        }
        if (result.greeting !== undefined && result.greeting.trim() === '') {
          result.greeting = template.default_greeting;
        }
        if (
          result.behavior_prompt !== undefined &&
          result.behavior_prompt.trim() === ''
        ) {
          result.behavior_prompt = template.default_prompt;
        }
        if (
          result.behavior_prompt !== undefined &&
          result.behavior_prompt.trim() === ''
        ) {
          result.behavior_prompt = template.default_behavior;
        }
        if (result.referral_bonus && !template.referral_bonus_eligible) {
          delete result.referral_bonus;
        }
      }
    } else if (result.referral_bonus) {
      // No resolvable template at all -> never eligible.
      delete result.referral_bonus;
    }

    return result;
  }

  private async resolveKnowledgeBaseIds(
    knowledgeBaseIds?: string[],
  ): Promise<string[]> {
    const ids = knowledgeBaseIds ?? [];
    if (ids.length === 0) {
      return [];
    }
    const uniqueIds = [...new Set(ids)];
    const found = await this.knowledgeBasesRepository.countByIds(uniqueIds);
    if (found !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more knowledge_base_ids do not exist',
      );
    }
    return uniqueIds;
  }
}
