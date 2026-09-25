import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { HealthStatus } from '@intentflow/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export default function MobileFoundationScreen() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'unavailable'>('loading');
  const [data, setData] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setStatus('loading');
    setError(null);
    try {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      const json: HealthStatus = await response.json();
      setData(json);
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus('unavailable');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'IntentFlow Foundation' }} />

      <View style={styles.card}>
        <Text style={styles.phaseBadge}>Phase 1 — Engineering Foundation</Text>
        <Text style={styles.title}>IntentFlow Mobile</Text>
        <Text style={styles.subtitle}>Development Connectivity Verification</Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Backend API Status:</Text>
          {status === 'loading' && (
            <View style={styles.row}>
              <ActivityIndicator size="small" color="#fbbf24" />
              <Text style={[styles.statusText, { color: '#fbbf24' }]}>Connecting...</Text>
            </View>
          )}

          {status === 'connected' && (
            <Text style={[styles.statusText, { color: '#34d399' }]}>
              Connected
            </Text>
          )}

          {status === 'unavailable' && (
            <Text style={[styles.statusText, { color: '#f87171' }]}>
              Unavailable
            </Text>
          )}
        </View>

        <View style={styles.detailsBox}>
          <Text style={styles.detailsTitle}>Endpoint: GET {API_URL}/health</Text>
          {status === 'connected' && data && (
            <Text style={styles.payloadText}>
              {JSON.stringify(data, null, 2)}
            </Text>
          )}
          {status === 'unavailable' && (
            <Text style={styles.errorText}>
              Error: {error || 'Unable to reach backend API endpoint'}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.button} onPress={checkHealth}>
          <Text style={styles.buttonText}>Re-test API Connectivity</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Temporary mobile development foundation screen.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#020617',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  phaseBadge: {
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    fontSize: 12,
    fontFamily: 'Courier',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  statusBox: {
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  detailsBox: {
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  detailsTitle: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Courier',
    marginBottom: 8,
  },
  payloadText: {
    color: '#6ee7b7',
    fontFamily: 'Courier',
    fontSize: 12,
  },
  errorText: {
    color: '#f87171',
    fontFamily: 'Courier',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  disclaimer: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
});
