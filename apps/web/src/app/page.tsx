'use client';

import { useEffect, useState } from 'react';
import { fetchApiHealth, ApiCheckState } from '@/lib/api-client';
import { APP_CONFIG } from '@intentflow/config';

export default function Home() {
  const [apiState, setApiState] = useState<ApiCheckState>({
    status: 'loading',
  });

  const checkConnectivity = async () => {
    setApiState((prev) => ({ ...prev, status: 'loading' }));
    const result = await fetchApiHealth();
    setApiState(result);
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
          <div>
            <span className="inline-block px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-2">
              Phase 1 — Engineering Foundation
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {APP_CONFIG.name} Web Application
            </h1>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 font-mono block">Environment</span>
            <span className="text-sm font-semibold text-slate-200">Development</span>
          </div>
        </div>

        {/* Status Card */}
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <span className="text-sm font-medium text-slate-300">Backend API Connectivity</span>

            {apiState.status === 'loading' && (
              <span className="inline-flex items-center gap-2 text-sm text-amber-400 font-mono">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                Connecting...
              </span>
            )}

            {apiState.status === 'connected' && (
              <span className="inline-flex items-center gap-2 text-sm text-emerald-400 font-mono font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                API Status: Connected
              </span>
            )}

            {apiState.status === 'unavailable' && (
              <span className="inline-flex items-center gap-2 text-sm text-rose-400 font-mono font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                API Status: Unavailable
              </span>
            )}
          </div>

          {/* Detailed Response Payload */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
            <div className="text-slate-400 mb-2 flex justify-between">
              <span>GET http://localhost:4000/health</span>
              {apiState.lastChecked && <span>Checked at: {apiState.lastChecked}</span>}
            </div>
            {apiState.status === 'connected' && apiState.data && (
              <pre className="text-emerald-300 overflow-x-auto">
                {JSON.stringify(apiState.data, null, 2)}
              </pre>
            )}
            {apiState.status === 'unavailable' && (
              <div className="text-rose-400">
                Error: {apiState.error || 'Could not reach backend API endpoint at http://localhost:4000/health'}
              </div>
            )}
            {apiState.status === 'loading' && (
              <div className="text-slate-500 italic">Executing health probe request...</div>
            )}
          </div>

          {/* Action */}
          <div className="flex justify-end pt-2">
            <button
              onClick={checkConnectivity}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              Re-test Connectivity
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 border-t border-slate-800/80 pt-4 text-xs text-slate-500 text-center">
          IntentFlow Technical Verification Page — No product features or business logic loaded.
        </div>
      </div>
    </main>
  );
}
