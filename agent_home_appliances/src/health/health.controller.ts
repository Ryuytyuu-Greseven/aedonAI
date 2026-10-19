import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AgentGateway } from '../agent/agent.gateway.js';
import { LLM_USAGE_MONGOOSE_CONNECTION } from '../common/llm-usage/index.js';

const MONGO_PING_TIMEOUT_MS = 2000;

// The service is otherwise WebSocket-only (/agent); these plain HTTP routes
// share the same port so load balancers / k8s probes can hit them.
@Controller('health')
export class HealthController {
  constructor(
    private readonly agentGateway: AgentGateway,
    @InjectConnection(LLM_USAGE_MONGOOSE_CONNECTION)
    private readonly mongo: Connection,
  ) {}

  // Liveness: the process is up and the HTTP server is answering.
  @Get()
  liveness() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      activeConnections: this.agentGateway.activeConnections,
      timestamp: new Date().toISOString(),
    };
  }

  // Readiness: dependencies needed to serve calls are reachable.
  @Get('ready')
  async readiness() {
    const mongo = await this.checkMongo();
    const body = {
      status: mongo === 'up' ? 'ok' : 'error',
      checks: { mongo },
      activeConnections: this.agentGateway.activeConnections,
      timestamp: new Date().toISOString(),
    };
    if (mongo !== 'up') throw new ServiceUnavailableException(body);
    return body;
  }

  private async checkMongo(): Promise<'up' | 'down'> {
    if (this.mongo.readyState !== 1 || !this.mongo.db) return 'down';
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mongo.db.admin().ping(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), MONGO_PING_TIMEOUT_MS);
        }),
      ]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
