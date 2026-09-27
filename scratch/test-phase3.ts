import WebSocket from 'ws';
import path from 'node:path';
import fs from 'node:fs';

const API_BASE = 'http://localhost:4000';
const WS_BASE = 'ws://localhost:4000';

async function req(endpoint: string, options: any = {}, token?: string) {
  const headers: any = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if ((options.method === 'POST' || options.method === 'PUT') && !options.body) {
    options.body = JSON.stringify({});
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function runTests() {
  console.log('=== STARTING INTENTFLOW PHASE 3 VERIFICATION TESTS ===\n');

  const ts = Date.now();

  // 1. Setup Auth & Users
  console.log('1. Setting up users and organization...');
  const devRes = await req('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Developer Dave', email: `dev_${ts}@test.com`, password: 'Password123!' }),
  });
  const devToken = devRes.json.data.token;
  const devUser = devRes.json.data.user;

  const clientRes = await req('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Client Chloe', email: `client_${ts}@test.com`, password: 'Password123!' }),
  });
  const clientToken = clientRes.json.data.token;
  const clientUser = clientRes.json.data.user;

  const strangerRes = await req('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Stranger Steve', email: `stranger_${ts}@test.com`, password: 'Password123!' }),
  });
  const strangerToken = strangerRes.json.data.token;

  // Create Organization
  const orgRes = await req('/api/organizations', {
    method: 'POST',
    body: JSON.stringify({ name: `Acme Corp ${ts}` }),
  }, devToken);
  const org = orgRes.json.data;

  // Invite Client Chloe to Organization
  const invRes = await req(`/api/organizations/${org.id}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email: clientUser.email, role: 'client' }),
  }, devToken);
  const invToken = invRes.json.data.token;

  // Client Chloe accepts invitation
  const acceptRes = await req(`/api/invitations/${invToken}/accept`, { method: 'POST' }, clientToken);
  console.log('   Debug accept invitation:', acceptRes.status, JSON.stringify(acceptRes.json));

  // Create Project
  const projRes = await req('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      organizationId: org.id,
      name: 'Mobile App Redesign',
      description: 'Full redesign of mobile experience',
      members: [
        { userId: clientUser.id, role: 'client' },
      ],
    }),
  }, devToken);
  const project = projRes.json.data;
  console.log('   ✓ Organization, Invitations, and Project created successfully');

  // 2. Create Conversation
  console.log('\n2. Testing Conversation Creation...');
  const convRes = await req(`/api/projects/${project.id}/conversations`, {
    method: 'POST',
    body: JSON.stringify({ title: 'UI Concept Review' }),
  }, devToken);

  if (convRes.status !== 201 || !convRes.json.success) {
    throw new Error(`Failed to create conversation: ${JSON.stringify(convRes.json)}`);
  }
  const conversation = convRes.json.data;
  console.log(`   ✓ Created Conversation: "${conversation.title}" (ID: ${conversation.id})`);

  // List Conversations
  const listRes = await req(`/api/projects/${project.id}/conversations`, {}, clientToken);
  if (listRes.status !== 200 || !listRes.json.data || listRes.json.data.length !== 1) {
    console.error('Debug listRes:', listRes.status, JSON.stringify(listRes.json));
    throw new Error('Failed to list conversations for project member');
  }
  console.log('   ✓ Client successfully listed project conversations');

  // 3. Message Sending & Retrieval
  console.log('\n3. Testing Message Persistence & Order...');
  const msg1Res = await req(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body: 'Hello Chloe! Here are the mockups for review.' }),
  }, devToken);
  console.log('   ✓ Developer sent message 1');

  const msg2Res = await req(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body: 'Thanks Dave! Looking into them now.' }),
  }, clientToken);
  console.log('   ✓ Client sent message 2');

  const fetchMsgsRes = await req(`/api/conversations/${conversation.id}/messages`, {}, devToken);
  if (fetchMsgsRes.status !== 200 || fetchMsgsRes.json.data.length !== 2) {
    throw new Error('Failed to fetch messages');
  }
  const fetchedMsgs = fetchMsgsRes.json.data;
  if (fetchedMsgs[0].body !== 'Hello Chloe! Here are the mockups for review.' || fetchedMsgs[1].body !== 'Thanks Dave! Looking into them now.') {
    throw new Error('Messages not returned in chronological order');
  }
  console.log('   ✓ Messages retrieved in exact chronological order');

  // 4. Pagination
  console.log('\n4. Testing Message Pagination...');
  for (let i = 3; i <= 7; i++) {
    await req(`/api/conversations/${conversation.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: `Test message ${i}` }),
    }, devToken);
  }

  const page1Res = await req(`/api/conversations/${conversation.id}/messages?limit=3`, {}, clientToken);
  if (page1Res.json.data.length !== 3 || !page1Res.json.nextCursor) {
    throw new Error(`Pagination failed on page 1: limit 3 expected, got ${page1Res.json.data.length}`);
  }
  console.log('   ✓ Pagination limit and nextCursor verified');

  // 5. Read State & Unread Tracking
  console.log('\n5. Testing Read State & Unread Tracking...');
  // Client posts a new message
  await req(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body: 'Latest update requiring dev review' }),
  }, clientToken);

  // Dev checks conversations -> unread should be true
  const devConvList1 = await req(`/api/projects/${project.id}/conversations`, {}, devToken);
  const targetConv1 = devConvList1.json.data.find((c: any) => c.id === conversation.id);
  if (!targetConv1.unread) {
    throw new Error('Expected conversation to be unread for developer');
  }
  console.log('   ✓ Unread state correctly identified for developer');

  // Dev marks read
  await req(`/api/conversations/${conversation.id}/read`, { method: 'POST' }, devToken);
  const devConvList2 = await req(`/api/projects/${project.id}/conversations`, {}, devToken);
  const targetConv2 = devConvList2.json.data.find((c: any) => c.id === conversation.id);
  if (targetConv2.unread) {
    throw new Error('Expected conversation to be read after mark read action');
  }
  console.log('   ✓ Conversation marked as read verified');

  // 6. Attachment Upload & Download
  console.log('\n6. Testing File Attachment Upload & Secure Download...');
  const formData = new FormData();
  const fileBlob = new Blob(['sample design spec content'], { type: 'text/plain' });
  formData.append('projectId', project.id);
  formData.append('file', fileBlob, 'spec.txt');

  const uploadRes = await fetch(`${API_BASE}/api/attachments/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clientToken}` },
    body: formData,
  });
  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok || !uploadJson.success) {
    throw new Error(`Attachment upload failed: ${JSON.stringify(uploadJson)}`);
  }
  const attachment = uploadJson.data;
  console.log(`   ✓ Attachment uploaded: ${attachment.fileName} (${attachment.id})`);

  // Send message with attachment
  const msgWithAttRes = await req(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      body: 'Attached project spec file',
      attachmentIds: [attachment.id],
    }),
  }, clientToken);
  const sentMsgWithAtt = msgWithAttRes.json.data;
  if (!sentMsgWithAtt.attachments || sentMsgWithAtt.attachments.length !== 1) {
    throw new Error('Attachment association with message failed');
  }
  console.log('   ✓ Message sent with attachment linked');

  // Download file
  const downloadRes = await fetch(`${API_BASE}/api/attachments/${attachment.id}/download`, {
    headers: { Authorization: `Bearer ${devToken}` },
  });
  const downloadedText = await downloadRes.text();
  if (downloadedText !== 'sample design spec content') {
    throw new Error(`Downloaded content mismatch: got "${downloadedText}"`);
  }
  console.log('   ✓ Attachment securely downloaded and verified');

  // 7. Authorization & IDOR Security Tests
  console.log('\n7. Testing Authorization & IDOR Controls...');
  const idor1 = await req(`/api/projects/${project.id}/conversations`, {}, strangerToken);
  if (idor1.status !== 403) throw new Error(`IDOR Fail: expected 403, got ${idor1.status}`);

  const idor2 = await req(`/api/conversations/${conversation.id}/messages`, {}, strangerToken);
  if (idor2.status !== 403) throw new Error(`IDOR Fail: expected 403, got ${idor2.status}`);

  const idor3 = await req(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body: 'Malicious injection' }),
  }, strangerToken);
  if (idor3.status !== 403) throw new Error(`IDOR Fail: expected 403, got ${idor3.status}`);

  console.log('   ✓ All IDOR & Authorization boundary checks PASSED (403 Forbidden)');

  // 8. Real-time WebSocket Messaging & Reconnection
  console.log('\n8. Testing WebSocket Real-time Messaging & Reconnection...');
  const wsUrl = `${WS_BASE}/api/conversations/${conversation.id}/ws?token=${encodeURIComponent(devToken)}`;

  const wsReceivedPromise = new Promise<any>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket message timeout'));
    }, 5000);

    ws.on('open', async () => {
      // Client sends message via HTTP while Dev is listening on WS
      await req(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: 'Real-time WebSocket Test Message' }),
      }, clientToken);
    });

    ws.on('message', (data) => {
      clearTimeout(timeout);
      const parsed = JSON.parse(data.toString());
      ws.close();
      resolve(parsed);
    });
  });

  const wsEvent = await wsReceivedPromise;
  if (wsEvent.type !== 'conversation.message.created' || wsEvent.message.body !== 'Real-time WebSocket Test Message') {
    throw new Error(`Invalid WS Event received: ${JSON.stringify(wsEvent)}`);
  }
  console.log('   ✓ Real-time WebSocket message broadcast received successfully!');

  // Test Reconnect catch-up
  // Send message while WS is disconnected
  await req(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body: 'Offline message sent during disconnect' }),
  }, clientToken);

  // Reconnect HTTP catch-up
  const reconnectMsgs = await req(`/api/conversations/${conversation.id}/messages?limit=5`, {}, devToken);
  const lastMsg = reconnectMsgs.json.data[reconnectMsgs.json.data.length - 1];
  if (lastMsg.body !== 'Offline message sent during disconnect') {
    throw new Error('Reconnection catch-up failed to load persisted offline message');
  }
  console.log('   ✓ Reconnection catch-up verified (persisted database messages retrieved)');

  console.log('\n=== ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
