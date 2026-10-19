export const environment = {
  production: true,
  // Assumes the API is served from the same origin behind a reverse proxy.
  // Replace with an absolute URL if the API is deployed separately.
  apiUrl: 'https://lyreai-agent-builder-server-588930377639.asia-south1.run.app/api',
  // audio_processor voice/chat WebSocket + REST host. Deployed separately from the REST API.
  wsUrl: 'wss://lyreai-agent-audio-processor-588930377639.asia-south1.run.app/ws',
  // Meta App ID (client_id) for the Admin Settings > Meta Integration OAuth flow.
  // Empty until a real app is registered in Meta's developer console — the
  // Connect button will redirect to a broken Meta OAuth URL until this is set.
  metaAppId: '28510174481950752',
};
