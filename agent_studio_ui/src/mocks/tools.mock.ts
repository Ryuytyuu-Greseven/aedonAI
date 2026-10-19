import { createToolParam, Tool } from '../app/core/models/agent.model';

export const SHARED_TOOLS: Tool[] = [
  {
    id: 'tool-search',
    name: 'web_search',
    description: 'Search the web for information',
    parameters: [createToolParam('query', 'string', 'Search query', true)],
    returns: 'Search results as text',
  },
  {
    id: 'tool-calendar',
    name: 'calendar_lookup',
    description: 'Look up calendar availability',
    parameters: [
      createToolParam('date', 'string', 'Date to check', true),
      createToolParam('duration', 'number', 'Duration in minutes', false),
    ],
    returns: 'Available time slots',
  },
  {
    id: 'tool-crm',
    name: 'crm_update',
    description: 'Update CRM contact record',
    parameters: [
      createToolParam('contact_id', 'string', 'CRM contact ID', true),
      createToolParam('field', 'string', 'Field to update', true),
      createToolParam('value', 'string', 'New value', true),
    ],
    returns: 'Updated contact record',
  },
];

export const MOCK_TOOLS: Record<string, Tool[]> = {
  'agent-1': [
    {
      id: 'tool-1a',
      name: 'greet_user',
      description: 'Send a greeting to the caller',
      parameters: [createToolParam('name', 'string', 'Caller name', true)],
      returns: 'Greeting message',
    },
    {
      id: 'tool-1b',
      name: 'lookup_account',
      description: 'Look up customer account by phone',
      parameters: [createToolParam('phone', 'string', 'Phone number', true)],
      returns: 'Account details',
    },
    SHARED_TOOLS[0],
  ],
  'agent-2': [
    {
      id: 'tool-2a',
      name: 'schedule_appointment',
      description: 'Book an appointment slot',
      parameters: [createToolParam('datetime', 'string', 'Appointment datetime', true)],
      returns: 'Booking confirmation',
    },
    SHARED_TOOLS[1],
  ],
  'agent-3': [
    {
      id: 'tool-3a',
      name: 'send_email',
      description: 'Send a follow-up email',
      parameters: [
        createToolParam('to', 'string', 'Recipient email', true),
        createToolParam('subject', 'string', 'Email subject', true),
      ],
      returns: 'Send status',
    },
    SHARED_TOOLS[2],
  ],
  'agent-4': [],
  'agent-5': [
    {
      id: 'tool-5a',
      name: 'transfer_call',
      description: 'Transfer call to human agent',
      parameters: [createToolParam('department', 'string', 'Target department', true)],
      returns: 'Transfer status',
    },
  ],
};
