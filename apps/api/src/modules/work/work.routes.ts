import { FastifyInstance } from 'fastify';
import { authenticateRequest, AuthenticatedRequest } from '../../lib/auth.js';
import { enforcePolicy } from '../../lib/permissions.js';
import { WorkProposalService } from '../../services/ai/work-proposal.service.js';
import { WorkItemService } from '../../services/work/work-item.service.js';
import {
  createWorkItemSchema,
  updateWorkItemSchema,
  assignWorkItemSchema,
  updateWorkItemStatusSchema,
  updateWorkProposalSchema,
  approveWorkProposalSchema,
} from '@intentflow/validation';

const proposalService = new WorkProposalService();
const workService = new WorkItemService();

export async function workRoutes(app: FastifyInstance) {
  // All HTTP API endpoints require authentication
  app.addHook('preHandler', authenticateRequest);

  // ==========================================
  // WORK PROPOSALS API
  // ==========================================

  /**
   * POST /api/intents/:intentId/work-proposals/generate
   * Generate an AI work proposal for a confirmed intent
   */
  app.post('/intents/:intentId/work-proposals/generate', async (request: AuthenticatedRequest, reply) => {
    try {
      const { intentId } = request.params as { intentId: string };
      const user = request.user!;

      const intentProj = await proposalService.getIntentProject(intentId);
      if (!intentProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Intent not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:generate_proposal', intentProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const proposal = await proposalService.generateProposal(intentId, user.id);
      return reply.status(200).send({ success: true, data: proposal });
    } catch (err: any) {
      console.error('Error generating work proposal:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/intents/:intentId/work-proposals
   * Get work proposals for a given intent
   */
  app.get('/intents/:intentId/work-proposals', async (request: AuthenticatedRequest, reply) => {
    try {
      const { intentId } = request.params as { intentId: string };
      const user = request.user!;

      const intentProj = await proposalService.getIntentProject(intentId);
      if (!intentProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Intent not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:view', intentProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const proposals = await proposalService.getProposalsForIntent(intentId);
      return reply.status(200).send({ success: true, data: proposals });
    } catch (err: any) {
      console.error('Error fetching work proposals:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/work-proposals/:proposalId
   * Get details of a single work proposal
   */
  app.get('/work-proposals/:proposalId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { proposalId } = request.params as { proposalId: string };
      const user = request.user!;

      const proposalProj = await proposalService.getProposalProject(proposalId);
      if (!proposalProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:view', proposalProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const proposal = await proposalService.getProposalWithItems(proposalId);
      return reply.status(200).send({ success: true, data: proposal });
    } catch (err: any) {
      console.error('Error fetching proposal detail:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * PATCH /api/work-proposals/:proposalId
   * Update proposal items (developer edit before approval)
   */
  app.patch('/work-proposals/:proposalId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { proposalId } = request.params as { proposalId: string };
      const user = request.user!;

      const proposalProj = await proposalService.getProposalProject(proposalId);
      if (!proposalProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:edit', proposalProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = updateWorkProposalSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const updated = await proposalService.updateProposalItems(proposalId, parseResult.data.items);
      return reply.status(200).send({ success: true, data: updated });
    } catch (err: any) {
      console.error('Error updating work proposal:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/work-proposals/:proposalId/approve
   * Approve proposal and convert items to real work_items
   */
  app.post('/work-proposals/:proposalId/approve', async (request: AuthenticatedRequest, reply) => {
    try {
      const { proposalId } = request.params as { proposalId: string };
      const user = request.user!;

      const proposalProj = await proposalService.getProposalProject(proposalId);
      if (!proposalProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:approve_proposal', proposalProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = approveWorkProposalSchema.safeParse(request.body || {});
      const modifiedItems = parseResult.success ? parseResult.data.items : undefined;

      const createdItems = await proposalService.approveProposal(proposalId, user.id, modifiedItems);
      return reply.status(200).send({
        success: true,
        data: {
          proposalId,
          workItems: createdItems,
        },
      });
    } catch (err: any) {
      console.error('Error approving work proposal:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/work-proposals/:proposalId/reject
   * Reject a work proposal
   */
  app.post('/work-proposals/:proposalId/reject', async (request: AuthenticatedRequest, reply) => {
    try {
      const { proposalId } = request.params as { proposalId: string };
      const user = request.user!;

      const proposalProj = await proposalService.getProposalProject(proposalId);
      if (!proposalProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:approve_proposal', proposalProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const rejected = await proposalService.rejectProposal(proposalId, user.id);
      return reply.status(200).send({ success: true, data: rejected });
    } catch (err: any) {
      console.error('Error rejecting work proposal:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  // ==========================================
  // WORK ITEMS API
  // ==========================================

  /**
   * POST /api/projects/:projectId/work
   * Create a manual work item
   */
  app.post('/projects/:projectId/work', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const user = request.user!;

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:create', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = createWorkItemSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const item = await workService.createWorkItem(projectId, user.id, parseResult.data);
      return reply.status(201).send({ success: true, data: item });
    } catch (err: any) {
      console.error('Error creating work item:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/projects/:projectId/work
   * List work items for a project (with optional status/assignedTo filtering and analytics metrics)
   */
  app.get('/projects/:projectId/work', async (request: AuthenticatedRequest, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const { status, assignedTo } = request.query as { status?: string; assignedTo?: string };
      const user = request.user!;

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:view', projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const workItems = await workService.getProjectWorkItems(projectId, { status, assignedTo });
      const metrics = await workService.getProjectWorkMetrics(projectId);

      return reply.status(200).send({
        success: true,
        data: {
          workItems,
          metrics,
        },
      });
    } catch (err: any) {
      console.error('Error listing work items:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/work/:workItemId
   * Get single work item details with requirement & intent traceability
   */
  app.get('/work/:workItemId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { workItemId } = request.params as { workItemId: string };
      const user = request.user!;

      const workProj = await workService.getWorkItemProject(workItemId);
      if (!workProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Work item not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:view', workProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const detail = await workService.getWorkItemDetails(workItemId);
      return reply.status(200).send({ success: true, data: detail });
    } catch (err: any) {
      console.error('Error fetching work item detail:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * PATCH /api/work/:workItemId
   * Update work item title, description, priority, due date
   */
  app.patch('/work/:workItemId', async (request: AuthenticatedRequest, reply) => {
    try {
      const { workItemId } = request.params as { workItemId: string };
      const user = request.user!;

      const workProj = await workService.getWorkItemProject(workItemId);
      if (!workProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Work item not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:edit', workProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = updateWorkItemSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const updated = await workService.updateWorkItem(workItemId, user.id, parseResult.data);
      return reply.status(200).send({ success: true, data: updated });
    } catch (err: any) {
      console.error('Error updating work item:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/work/:workItemId/assign
   * Assign or unassign work item
   */
  app.post('/work/:workItemId/assign', async (request: AuthenticatedRequest, reply) => {
    try {
      const { workItemId } = request.params as { workItemId: string };
      const user = request.user!;

      const workProj = await workService.getWorkItemProject(workItemId);
      if (!workProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Work item not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:assign', workProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = assignWorkItemSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const updated = await workService.assignWorkItem(workItemId, user.id, parseResult.data.assignedTo);
      return reply.status(200).send({ success: true, data: updated });
    } catch (err: any) {
      console.error('Error assigning work item:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * POST /api/work/:workItemId/status
   * Transition work item status
   */
  app.post('/work/:workItemId/status', async (request: AuthenticatedRequest, reply) => {
    try {
      const { workItemId } = request.params as { workItemId: string };
      const user = request.user!;

      const workProj = await workService.getWorkItemProject(workItemId);
      if (!workProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Work item not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:change_status', workProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = updateWorkItemStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const updated = await workService.updateWorkItemStatus(workItemId, user.id, parseResult.data.status);
      return reply.status(200).send({ success: true, data: updated });
    } catch (err: any) {
      console.error('Error updating status:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * PATCH /api/work/:workItemId/status
   * Transition work item status (Alias for PATCH method)
   */
  app.patch('/work/:workItemId/status', async (request: AuthenticatedRequest, reply) => {
    try {
      const { workItemId } = request.params as { workItemId: string };
      const user = request.user!;

      const workProj = await workService.getWorkItemProject(workItemId);
      if (!workProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Work item not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:change_status', workProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const parseResult = updateWorkItemStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.format() },
        });
      }

      const updated = await workService.updateWorkItemStatus(workItemId, user.id, parseResult.data.status);
      return reply.status(200).send({ success: true, data: updated });
    } catch (err: any) {
      console.error('Error updating status:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });

  /**
   * GET /api/work/:workItemId/activity
   * Get audit log timeline of events for a work item
   */
  app.get('/work/:workItemId/activity', async (request: AuthenticatedRequest, reply) => {
    try {
      const { workItemId } = request.params as { workItemId: string };
      const user = request.user!;

      const workProj = await workService.getWorkItemProject(workItemId);
      if (!workProj) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Work item not found' } });
      }

      const orgId = (request.headers['x-organization-id'] as string) || '';
      const policy = await enforcePolicy(user.id, orgId, 'work:view_activity', workProj.projectId);
      if (!policy.allowed) {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: policy.reason } });
      }

      const activity = await workService.getWorkItemActivity(workItemId);
      return reply.status(200).send({ success: true, data: activity });
    } catch (err: any) {
      console.error('Error fetching work item activity:', err);
      return reply.status(500).send({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  });
}
