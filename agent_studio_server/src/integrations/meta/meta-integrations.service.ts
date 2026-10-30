import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { ConnectedPageSummary } from '../../common/interfaces/connected-page.interface';
import { assertSameCompany } from '../../common/utils/company-scope.util';
import { AgentsRepository } from '../../repos/agents.repository';
import { ConnectedPagesRepository } from '../../repos/connected-pages.repository';
import { MetaLeadsRepository } from '../../repos/meta-leads.repository';
import { ConnectedPageDocument } from '../../schemas/connected-page.schema';
import { MetaLead } from '../../schemas/meta-leads.schema';
import { AssignAgentToPageDto } from './dto/assign-agent-to-page.dto';
import { ConnectMetaDto } from './dto/connect-meta.dto';
import { ListMetaLeadsQueryDto } from './dto/list-meta-leads-query.dto';

@Injectable()
export class MetaIntegrationsService {
  private readonly logger = new Logger(MetaIntegrationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly connectedPagesRepository: ConnectedPagesRepository,
    private readonly agentsRepository: AgentsRepository,
    private readonly metaLeadsRepository: MetaLeadsRepository,
  ) {}

  /**
   * Exchanges the OAuth code for Page tokens by delegating to meta-adapter's
   * own `/meta/oauth/exchange`, which owns the actual Graph API/webhook
   * subscription logic. meta-adapter validates the caller's JWT itself
   * (shared users/revoked_tokens DB), so the original Authorization header
   * is forwarded as-is rather than us resolving/sending companyId.
   */
  async connect(
    dto: ConnectMetaDto,
    authorizationHeader: string,
  ): Promise<unknown> {
    return this.postToMetaAdapter(
      '/meta/oauth/exchange',
      { code: dto.code },
      authorizationHeader,
      'Meta adapter failed to process the connect request',
    );
  }

  /**
   * Places a call to one of the caller's leads (the leads page "Call"
   * action) by delegating to meta-adapter's `/meta/leads/:leadgenId/call`,
   * which owns the dialing logic (Page's linked agent → calls gateway). As
   * with `connect`, the caller's JWT is forwarded and meta-adapter
   * re-validates it and scopes the lead to the caller's company itself.
   */
  async callLead(
    leadgenId: string,
    authorizationHeader: string,
  ): Promise<unknown> {
    return this.postToMetaAdapter(
      `/meta/leads/${encodeURIComponent(leadgenId)}/call`,
      {},
      authorizationHeader,
      'The call could not be placed',
    );
  }

  /** Calls one manual lead (`agent_leads`) via meta-adapter, which owns lead calling. */
  async callManualLead(
    leadId: string,
    authorizationHeader: string,
  ): Promise<unknown> {
    return this.postToMetaAdapter(
      `/leads/manual/${encodeURIComponent(leadId)}/call`,
      {},
      authorizationHeader,
      'The call could not be placed',
    );
  }

  /** Stores (or reuses today's) manual lead for a typed-in number and calls it. */
  async dialManualLead(
    body: {
      agentId: string;
      phoneNumber: string;
      fullName: string;
      leadDay: string;
    },
    authorizationHeader: string,
  ): Promise<unknown> {
    return this.postToMetaAdapter(
      '/leads/manual/dial',
      body,
      authorizationHeader,
      'The call could not be placed',
    );
  }

  /**
   * Lists the caller's Meta leads for one agent (paginated, with optional
   * name/phone search and a date range). Resolves the agent's linked Page
   * ids from `connectedpages`, then filters `meta_leads` down to just
   * those Pages — no call to meta-adapter itself is needed here.
   */
  async listLeads(
    companyId: string | null,
    query: ListMetaLeadsQueryDto,
  ): Promise<{
    leads: MetaLead[];
    total: number;
    page: number;
    limit: number;
  }> {
    const customerId = this.requireCompanyId(companyId);
    await this.assertAgentInCompany(query.agentId, companyId);

    const pageIds = await this.connectedPagesRepository.findPageIdsByAgentId(
      customerId,
      query.agentId,
    );
    if (pageIds.length === 0) {
      // Valid agent, just nothing linked to it yet — an empty page, not an error.
      return {
        leads: [],
        total: 0,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      };
    }

    const { items, total } =
      await this.metaLeadsRepository.findByCustomerIdAndPageIds(
        customerId,
        pageIds,
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
   * Lists every Page connected under the caller's company, active or
   * disabled. Reads directly from the shared `connectedpages` collection
   * meta-adapter writes to — no call to meta-adapter itself is needed here.
   */
  async listPages(
    companyId: string | null,
  ): Promise<{ pages: ConnectedPageSummary[] }> {
    const customerId = this.requireCompanyId(companyId);
    const pages =
      await this.connectedPagesRepository.findByCustomerId(customerId);
    return { pages: pages.map(toSummary) };
  }

  /**
   * Soft-disconnects a single Page: flips `isActive` to false rather than
   * deleting the row, so its Page id/agent link/token are kept and it can be
   * re-enabled without going through OAuth again.
   */
  async disablePage(
    companyId: string | null,
    pageId: string,
  ): Promise<{ page: ConnectedPageSummary }> {
    return this.setPageActive(companyId, pageId, false);
  }

  /** Reverses `disablePage`. */
  async enablePage(
    companyId: string | null,
    pageId: string,
  ): Promise<{ page: ConnectedPageSummary }> {
    return this.setPageActive(companyId, pageId, true);
  }

  /**
   * Full disconnect: permanently deletes every Page connected under the
   * caller's company. There is no undo/re-enable for this — unlike the
   * per-page/bulk `disable` toggle, the rows themselves are gone (agent
   * links and tokens included).
   */
  async disconnectAllPages(
    companyId: string | null,
  ): Promise<{ success: true; deletedCount: number }> {
    const customerId = this.requireCompanyId(companyId);
    const deletedCount =
      await this.connectedPagesRepository.deleteAllByCustomerId(customerId);
    return { success: true, deletedCount };
  }

  /** Bulk-reverses individual `disablePage` calls (does not affect deletions). */
  async enableAllPages(
    companyId: string | null,
  ): Promise<{ success: true; updatedCount: number }> {
    return this.setAllPagesActive(companyId, true);
  }

  /**
   * Links a Page to the agent that should handle its leads/live calls.
   * Validates the agent exists and belongs to the same company before
   * writing the link.
   */
  async assignAgentToPage(
    companyId: string | null,
    pageId: string,
    dto: AssignAgentToPageDto,
  ): Promise<{ page: ConnectedPageSummary }> {
    const customerId = this.requireCompanyId(companyId);
    await this.assertAgentInCompany(dto.agentId, companyId);

    const updated = await this.connectedPagesRepository.setAgentByPageId(
      customerId,
      pageId,
      dto.agentId,
    );
    if (!updated) {
      throw new NotFoundException(
        `Connected page ${pageId} not found for this company`,
      );
    }
    return { page: toSummary(updated) };
  }

  /** Clears a Page's agent link without affecting its connection status. */
  async unassignAgentFromPage(
    companyId: string | null,
    pageId: string,
  ): Promise<{ page: ConnectedPageSummary }> {
    const customerId = this.requireCompanyId(companyId);
    const updated = await this.connectedPagesRepository.setAgentByPageId(
      customerId,
      pageId,
      null,
    );
    if (!updated) {
      throw new NotFoundException(
        `Connected page ${pageId} not found for this company`,
      );
    }
    return { page: toSummary(updated) };
  }

  private async setPageActive(
    companyId: string | null,
    pageId: string,
    isActive: boolean,
  ): Promise<{ page: ConnectedPageSummary }> {
    const customerId = this.requireCompanyId(companyId);
    const updated = await this.connectedPagesRepository.setActiveByPageId(
      customerId,
      pageId,
      isActive,
    );
    if (!updated) {
      throw new NotFoundException(
        `Connected page ${pageId} not found for this company`,
      );
    }
    return { page: toSummary(updated) };
  }

  private async setAllPagesActive(
    companyId: string | null,
    isActive: boolean,
  ): Promise<{ success: true; updatedCount: number }> {
    const customerId = this.requireCompanyId(companyId);
    const updatedCount =
      await this.connectedPagesRepository.setActiveForAllByCustomerId(
        customerId,
        isActive,
      );
    return { success: true, updatedCount };
  }

  /**
   * POSTs to meta-adapter with the caller's Authorization header. 4xx
   * responses (bad/expired code, lead not found, call already in progress,
   * revoked token) are relayed as-is so the caller sees the real reason;
   * 5xx and network failures become a 502 with `failureMessage`.
   */
  private async postToMetaAdapter(
    path: string,
    body: Record<string, unknown>,
    authorizationHeader: string,
    failureMessage: string,
  ): Promise<unknown> {
    const baseUrl = this.config
      .getOrThrow<string>('META_ADAPTER_URL')
      .replace(/\/+$/, '');
    const url = `${baseUrl}${path}`;

    try {
      const { data } = await axios.post<unknown>(url, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorizationHeader,
        },
      });
      return data;
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        const status = error.response.status;
        const responseBody: unknown = error.response.data;
        if (status < 500) {
          throw new HttpException(
            responseBody as Record<string, unknown>,
            status,
          );
        }
        this.logger.error(
          `Meta adapter responded with ${status} for ${url}: ${JSON.stringify(responseBody)}`,
        );
        throw new BadGatewayException({
          message: failureMessage,
          status,
          details: responseBody,
        });
      }

      this.logger.error(
        `Failed to reach meta adapter at ${url}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadGatewayException('Failed to reach the meta adapter server');
    }
  }

  private requireCompanyId(companyId: string | null): string {
    if (!companyId) {
      throw new BadRequestException('User is not associated with a company');
    }
    return companyId;
  }

  private async assertAgentInCompany(
    agentId: string,
    companyId: string | null,
  ): Promise<void> {
    const agent = await this.agentsRepository.filterById(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }
    assertSameCompany(companyId, agent.companyId, `Agent ${agentId} not found`);
  }
}

function toSummary(page: ConnectedPageDocument): ConnectedPageSummary {
  return {
    pageId: page.pageId,
    pageName: page.pageName ?? null,
    isActive: page.isActive,
    agentId: page.agentId ?? null,
    connectedAt: page.createdAt ?? null,
  };
}
