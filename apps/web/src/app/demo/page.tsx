'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiDemoLogin } from '../../lib/api-client';
import { Card, Button, Badge } from '../../components/ui';

export default function DemoPage() {
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDemoLogin = async (role: 'admin' | 'developer' | 'client') => {
    setLoadingRole(role);
    setErrorMsg(null);
    try {
      const res = await apiDemoLogin(role);
      if (res.token) {
        router.push('/dashboard');
      } else {
        setErrorMsg('Failed to initialize demo session. Please try again.');
      }
    } catch (err: any) {
      console.error('Demo authentication error:', err);
      setErrorMsg(err.message || 'Unable to connect to IntentFlow API.');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090D16', color: '#F1F5F9', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '900px', width: '100%', textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Badge variant="indigo">Portfolio Interactive Demo</Badge>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#FFFFFF', marginBottom: '1rem' }}>
          Explore <span style={{ background: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>IntentFlow</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: '#94A3B8', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
          Turn messy client communication into structured, verified work. Select a role below to experience the human-in-the-loop AI workflow.
        </p>
      </div>

      {errorMsg && (
        <div style={{ maxWidth: '900px', width: '100%', marginBottom: '2rem', padding: '1rem', borderRadius: '0.5rem', backgroundColor: '#451A1A', border: '1px solid #7F1D1D', color: '#FCA5A5', textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', maxWidth: '900px', width: '100%' }}>
        {/* Client Demo Card */}
        <Card style={{ backgroundColor: '#131B2E', borderColor: '#1E293B', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.75rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <Badge variant="emerald">Client Persona</Badge>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '0.5rem' }}>Michael Vance</h2>
            <p style={{ fontSize: '0.875rem', color: '#94A3B8', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Review project deliverables, request changes, approve milestones, and view transparent activity feeds.
            </p>
          </div>
          <Button
            variant="primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loadingRole !== null}
            onClick={() => handleDemoLogin('client')}
          >
            {loadingRole === 'client' ? 'Initializing...' : 'Continue as Client →'}
          </Button>
        </Card>

        {/* Developer Demo Card */}
        <Card style={{ backgroundColor: '#131B2E', borderColor: '#1E293B', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.75rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <Badge variant="amber">Developer Persona</Badge>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '0.5rem' }}>Sarah Chen</h2>
            <p style={{ fontSize: '0.875rem', color: '#94A3B8', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Verify AI intent interpretations, manage requirement confidence, execute work items, and submit deliverables.
            </p>
          </div>
          <Button
            variant="secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loadingRole !== null}
            onClick={() => handleDemoLogin('developer')}
          >
            {loadingRole === 'developer' ? 'Initializing...' : 'Continue as Developer →'}
          </Button>
        </Card>

        {/* Admin Demo Card */}
        <Card style={{ backgroundColor: '#131B2E', borderColor: '#1E293B', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.75rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <Badge variant="indigo">Workspace Admin</Badge>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '0.5rem' }}>Alex Rivera</h2>
            <p style={{ fontSize: '0.875rem', color: '#94A3B8', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Manage team assignments, configure organization settings, invite members, and monitor project health.
            </p>
          </div>
          <Button
            variant="secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loadingRole !== null}
            onClick={() => handleDemoLogin('admin')}
          >
            {loadingRole === 'admin' ? 'Initializing...' : 'Continue as Admin →'}
          </Button>
        </Card>
      </div>

      <div style={{ marginTop: '3rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748B' }}>
        Deterministic Seed Data: <strong style={{ color: '#94A3B8' }}>Nexus Digital Agency</strong> &bull; Demo credentials pre-loaded.
      </div>
    </div>
  );
}
